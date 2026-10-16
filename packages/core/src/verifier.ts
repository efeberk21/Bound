import { randomUUID } from "node:crypto";
import { keccak256, recoverTypedDataAddress, type Hex } from "viem";
import { readGrantAuthority } from "./authority.js";
import {
  contentBodySchema,
  envelopeSchema,
  previewBodySchema,
  type Decision,
  type Envelope,
  type ServiceId,
} from "./contracts.js";
import { typedRequest } from "./signing.js";
import {
  challengeExists,
  observeHead,
  type VerifiedOperation,
} from "./runtime.js";
import { database } from "./db.js";

export type Verification = {
  result: Decision;
  verified?: VerifiedOperation;
  body?:
    | ReturnType<typeof previewBodySchema.parse>
    | ReturnType<typeof contentBodySchema.parse>;
};

export async function verifyToolRequest(input: {
  raw: Buffer;
  envelope: unknown;
  signature: Hex;
  serviceId: ServiceId;
  deploymentId: string;
  owner: string;
  rpcUrl?: string;
}): Promise<Verification> {
  const base: Decision = {
    decision: "DENY",
    reasonCode: "INVALID_PAYLOAD",
    serviceId: input.serviceId,
    grantKey: "",
    checkedAt: new Date().toISOString(),
    requestId: randomUUID(),
  };
  const reject = (reasonCode: string, unavailable = false): Verification => ({
    result: {
      ...base,
      decision: unavailable ? "UNAVAILABLE" : "DENY",
      reasonCode,
    },
  });
  const parsed = envelopeSchema.safeParse(input.envelope);
  if (!parsed.success || input.raw.length > 8192)
    return reject("INVALID_PAYLOAD");
  const envelope: Envelope = parsed.data;
  base.grantKey = envelope.grantKey;
  let body: Verification["body"];
  try {
    body = (
      input.serviceId === "bound.content.v1"
        ? contentBodySchema
        : previewBodySchema
    ).parse(JSON.parse(input.raw.toString("utf8")));
  } catch {
    return reject("INVALID_PAYLOAD");
  }
  const expectedAction =
    input.serviceId === "bound.content.v1" ? "content.read" : "preview.update";
  if (
    envelope.serviceId !== input.serviceId ||
    envelope.action !== expectedAction ||
    body.action !== expectedAction ||
    envelope.resource !== body.resource
  )
    return reject("WRONG_SCOPE");
  if (keccak256(input.raw) !== envelope.bodyHash)
    return reject("BODY_TAMPERED");
  let agent: Hex;
  try {
    agent = await recoverTypedDataAddress({
      ...typedRequest(input.deploymentId, envelope),
      signature: input.signature,
    });
  } catch {
    return reject("BAD_SIGNATURE");
  }
  try {
    if (!(await challengeExists(envelope, agent, input.deploymentId)))
      return reject("NONCE_INVALID");
    const authority = await readGrantAuthority({
      envelope,
      agent,
      owner: input.owner,
      deploymentId: input.deploymentId,
      ...(input.rpcUrl ? { rpcUrl: input.rpcUrl } : {}),
      nowMs: async () => {
        const clock =
          await database()`SELECT extract(epoch FROM clock_timestamp()) * 1000 AS now_ms`;
        return Number(clock[0]!.now_ms);
      },
      observeHead: (block) =>
        observeHead(input.deploymentId, input.serviceId, block),
    });
    if (authority.checkedBlock) base.checkedBlock = authority.checkedBlock;
    if (authority.observedCreator)
      base.observedCreator = authority.observedCreator;
    if (!authority.ok)
      return reject(authority.reasonCode, authority.unavailable);
    base.checkedAt = new Date(authority.checkedAtMs).toISOString();
    return {
      result: { ...base, decision: "ALLOW", reasonCode: "GRANT_VALID" },
      body,
      verified: {
        envelope,
        agent,
        deploymentId: input.deploymentId,
        checkedBlock: BigInt(authority.checkedBlock),
        checkedAtMs: authority.checkedAtMs,
        notAfterUnix: authority.grant.notAfterUnix,
      },
    };
  } catch {
    return reject("DEPENDENCY_UNAVAILABLE", true);
  }
}
