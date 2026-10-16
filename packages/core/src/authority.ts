import type { Hex } from "viem";
import { arkivClient, grantQuery } from "./arkiv.js";
import { CHAIN_ID, type Envelope, type Grant } from "./contracts.js";
import { evaluateGrant } from "./policy.js";

type Observation = { checkedBlock?: string; observedCreator?: string };
function completeBlock(block: { timestamp: unknown; hash: unknown }) {
  return (
    typeof block.timestamp === "bigint" &&
    block.timestamp > 0n &&
    typeof block.hash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(block.hash)
  );
}
type Authority = Observation &
  (
    | {
        ok: true;
        grant: Grant;
        checkedBlock: string;
        checkedAtMs: number;
        query: string;
      }
    | { ok: false; reasonCode: string; unavailable?: boolean }
  );

// Shared read-only contract. The server supplies DB time and a shared high-water
// guard; a stateless inspector supplies its clock and keeps every RPC guard.
export async function readGrantAuthority(input: {
  envelope: Envelope;
  agent: string;
  owner: string;
  deploymentId: string;
  rpcUrl?: string;
  nowMs: () => Promise<number>;
  observeHead?: (block: bigint) => Promise<boolean>;
}): Promise<Authority> {
  const observed: Observation = {};
  const reject = (reasonCode: string, unavailable = true): Authority => ({
    ...observed,
    ok: false,
    reasonCode,
    unavailable,
  });
  try {
    const client = arkivClient(input.rpcUrl);
    if ((await client.getChainId()) !== CHAIN_ID) return reject("WRONG_CHAIN");
    let head = await client.getBlock({ blockTag: "latest" });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (head.number === null || !completeBlock(head))
        return reject("MISSING_CHAIN_FIELDS");
      const age = (await input.nowMs()) / 1000 - Number(head.timestamp);
      if (!Number.isFinite(age) || age > 15 || age < -5)
        return reject("STALE_STATE");
      if (input.observeHead && !(await input.observeHead(head.number)))
        return reject("STATE_REGRESSION");
      const query = grantQuery(
        client,
        input.envelope.grantKey as Hex,
        head.number,
      );
      const page = await query.fetch();
      if (page.blockNumber !== head.number) return reject("SNAPSHOT_MISMATCH");
      const entity = page.entities[0] ?? null;
      observed.checkedBlock = head.number.toString();
      if (entity?.creator) observed.observedCreator = entity.creator;
      const after = await client.getBlock({ blockTag: "latest" });
      if (after.number === null || !completeBlock(after))
        return reject("MISSING_CHAIN_FIELDS");
      if (after.number !== head.number || after.hash !== head.hash) {
        if (attempt === 0) {
          head = after;
          continue;
        }
        return reject("UNSTABLE_HEAD");
      }
      const checkedAtMs = await input.nowMs();
      const finalAge = checkedAtMs / 1000 - Number(after.timestamp);
      if (!Number.isFinite(finalAge) || finalAge > 15 || finalAge < -5)
        return reject("STALE_STATE");
      const policy = evaluateGrant(entity, {
        ...input,
        block: head.number,
        nowUnix: checkedAtMs / 1000,
      });
      if (!policy.ok)
        return reject(policy.reasonCode, policy.unavailable ?? false);
      return {
        ...observed,
        ok: true,
        grant: policy.grant,
        checkedBlock: head.number.toString(),
        checkedAtMs,
        query: query.toString(),
      };
    }
    return reject("UNSTABLE_HEAD");
  } catch {
    return reject("DEPENDENCY_UNAVAILABLE");
  }
}
