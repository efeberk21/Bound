import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, type Hex, type TransactionReceipt } from "viem";
import { database } from "../packages/core/src/db.js";
import {
  reconcileSigner,
  requestChainOperation,
  resumeChainOperation,
  type ChainState,
} from "../packages/core/src/chain.js";

const rpc = vi.hoisted(() => ({
  receipt: null as TransactionReceipt | null,
  unavailable: false,
  sent: [] as string[],
  prepare: 0,
  persist: false,
  onSend: null as null | (() => Promise<boolean>),
  persistedBeforeSend: false,
}));
vi.mock("../packages/core/src/arkiv.js", () => ({
  publicRpc: "http://unused.invalid",
  arkivClient: () => ({
    getTransactionReceipt: async () => {
      if (rpc.unavailable) throw new Error("Unavailable");
      if (rpc.receipt) return rpc.receipt;
      throw Object.assign(new Error("Pending"), {
        name: "TransactionReceiptNotFoundError",
      });
    },
  }),
}));
vi.mock("viem/actions", () => ({
  sendRawTransaction: async (
    _client: unknown,
    input: { serializedTransaction: string },
  ) => {
    rpc.sent.push(input.serializedTransaction);
    if (rpc.onSend) rpc.persistedBeforeSend = await rpc.onSend();
    // Simulate a successful send whose response is lost.
    throw new Error("Response lost");
  },
}));
vi.mock("@arkiv-network/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@arkiv-network/sdk")>();
  return {
    ...actual,
    createWalletClient: (options: {
      chain: unknown;
      transport: (input: { chain: unknown }) => {
        request: (input: unknown) => Promise<unknown>;
      };
    }) => ({
      createEntity: async () => {
        rpc.prepare++;
        if (rpc.persist)
          await options
            .transport({ chain: options.chain })
            .request({ method: "eth_sendRawTransaction", params: ["0x1234"] });
        throw new Error("Preparation network failure");
      },
    }),
  };
});
if (existsSync(".env")) process.loadEnvFile(".env");
const sql = database();
const privateKey = generatePrivateKey();
const signer = privateKeyToAccount(privateKey).address.toLowerCase();
const oldRun = randomUUID(),
  newRun = randomUUID();
const raw = "0x1234";
const previous = { ...process.env };
async function insert(
  status: ChainState["status"],
  signed = false,
  stale = true,
) {
  const rows =
    await sql`INSERT INTO chain_operations(id,run_id,resource,operation,signer,status,claim_token,
    raw_transaction,transaction_hash,entity_key,updated_at)
    VALUES (${randomUUID()}::uuid,${oldRun}::uuid,${`demo://bound/${oldRun}/atlas`},'revoke',${signer},${status},${randomUUID()}::uuid,
      ${signed ? raw : null},${signed ? keccak256(raw) : null},${`0x${"22".repeat(32)}`},
      clock_timestamp()-make_interval(secs=>${stale ? 60 : 0})) RETURNING *`;
  return rows[0] as ChainState;
}
async function current(id: string) {
  const rows = await sql`SELECT * FROM chain_operations WHERE id=${id}::uuid`;
  return rows[0] as ChainState;
}
describe.sequential(
  "Chain recovery across sessions (real Neon; mocked chain, no transactions sent)",
  () => {
    beforeAll(async () => {
      process.env.DEMO_OWNER_PRIVATE_KEY = privateKey;
      process.env.DEMO_OWNER_ADDRESS = signer;
      await sql`INSERT INTO sessions(run_id,deployment_id,created_at,expires_at) VALUES
      (${oldRun}::uuid,'chain-recovery',clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '5 minutes'),
      (${newRun}::uuid,'chain-recovery',clock_timestamp(),clock_timestamp()+interval '5 minutes')`;
    });
    beforeEach(async () => {
      await sql`DELETE FROM chain_operations WHERE run_id IN (${oldRun}::uuid,${newRun}::uuid)`;
      rpc.receipt = null;
      rpc.unavailable = false;
      rpc.sent = [];
      rpc.prepare = 0;
      rpc.persist = false;
      rpc.onSend = null;
      rpc.persistedBeforeSend = false;
    });
    afterAll(async () => {
      await sql`DELETE FROM sessions WHERE run_id IN (${oldRun}::uuid,${newRun}::uuid)`;
      process.env = previous;
    });
    const request = () =>
      requestChainOperation({
        resource: `demo://bound/${newRun}/atlas`,
        operation: "grant",
        agent: signer as Hex,
        deploymentId: "chain-recovery",
      });
    it("fences an expired unsigned claim before a new session can prepare", async () => {
      const old = await insert("preparing");
      expect((await request()).status).toBe("failed");
      expect(rpc.prepare).toBe(1);
      const recovered = await current(old.id);
      expect(recovered.error_code).toBe("PREPARATION_LEASE_EXPIRED");
      expect(recovered.claim_token).not.toBe(old.claim_token);
      // The old function wakes after the replacement operation has begun.
      const late =
        await sql`UPDATE chain_operations SET raw_transaction=${raw},transaction_hash=${keccak256(raw)},status='prepared'
      WHERE id=${old.id}::uuid AND claim_token=${old.claim_token}::uuid AND status='preparing' AND raw_transaction IS NULL RETURNING id`;
      expect(late).toHaveLength(0);
      expect(rpc.sent).toHaveLength(0);
    });
    it("does not steal a live unsigned preparation lease", async () => {
      const old = await insert("preparing", false, false);
      await expect(request()).rejects.toThrow("SIGNER_BUSY");
      expect((await current(old.id)).claim_token).toBe(old.claim_token);
      expect(rpc.prepare).toBe(0);
    });
    it.each(["prepared", "submitted"] as const)(
      "keeps an uncertain %s operation locked and rebroadcasts identical bytes",
      async (status) => {
        const old = await insert(status, true);
        await reconcileSigner(signer);
        await expect(request()).rejects.toThrow("SIGNER_BUSY");
        expect(rpc.sent.length).toBeGreaterThan(0);
        expect(rpc.sent.every((bytes) => bytes === raw)).toBe(true);
        expect((await current(old.id)).raw_transaction).toBe(raw);
        expect(rpc.prepare).toBe(0);
      },
    );
    it("reconciles a confirmed old receipt before preparing a new session operation", async () => {
      const old = await insert("submitted", true);
      rpc.receipt = {
        status: "success",
        blockNumber: 123n,
        logs: [],
      } as unknown as TransactionReceipt;
      await request();
      expect((await current(old.id)).status).toBe("confirmed");
      expect(rpc.prepare).toBe(1);
      expect(rpc.sent).toHaveLength(0);
    });
    it("retains the lock during a receipt dependency outage", async () => {
      const old = await insert("prepared", true);
      rpc.unavailable = true;
      expect((await resumeChainOperation(old)).status).toBe("prepared");
      await expect(request()).rejects.toThrow("SIGNER_BUSY");
      expect(rpc.sent).toHaveLength(0);
      expect(rpc.prepare).toBe(0);
    });
    it("two recoverers fence a stale preparation once", async () => {
      const old = await insert("preparing");
      const results = await Promise.all([
        resumeChainOperation(old),
        resumeChainOperation(old),
      ]);
      expect(results.every((result) => result.status === "failed")).toBe(true);
      expect(results[0]!.claim_token).toBe(results[1]!.claim_token);
    });
    it("persists signed bytes before sending and resumes response loss without another preparation", async () => {
      rpc.persist = true;
      rpc.onSend = async () => {
        const rows =
          await sql`SELECT raw_transaction,transaction_hash FROM chain_operations WHERE run_id=${newRun}::uuid`;
        return (
          rows[0]?.raw_transaction === raw &&
          rows[0]?.transaction_hash === keccak256(raw)
        );
      };
      const first = await request();
      expect(rpc.persistedBeforeSend).toBe(true);
      expect(first.status).toBe("prepared");
      const resumed = await request();
      expect(resumed.id).toBe(first.id);
      expect(rpc.prepare).toBe(1);
      expect(rpc.sent.every((bytes) => bytes === raw)).toBe(true);
    });
    it("releases the signer only after a receipt establishes a reverted transaction", async () => {
      const old = await insert("submitted", true);
      rpc.receipt = {
        status: "reverted",
        blockNumber: 123n,
        logs: [],
      } as unknown as TransactionReceipt;
      await request();
      expect((await current(old.id)).status).toBe("failed");
      expect(rpc.prepare).toBe(1);
    });
  },
);
