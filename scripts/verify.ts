import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { readGrantAuthority } from "../packages/core/src/authority.js";
import {
  addressSchema,
  keySchema,
  resourceSchema,
  type Envelope,
} from "../packages/core/src/contracts.js";
if (existsSync(".env")) process.loadEnvFile(".env");
export async function verifyIndependent(grantKey: string, resource: string) {
  keySchema.parse(grantKey);
  resourceSchema.parse(resource);
  const owner = addressSchema.parse(process.env.DEMO_OWNER_ADDRESS);
  const agent = addressSchema.parse(process.env.AGENT_ADDRESS);
  const deploymentId = process.env.DEPLOYMENT_ID;
  if (!deploymentId) throw new Error("DEPLOYMENT_NOT_CONFIGURED");
  const envelope: Envelope = {
    serviceId: "bound.preview.v1",
    action: "preview.update",
    resource,
    grantKey,
    bodyHash: `0x${"00".repeat(32)}`,
    nonce: `0x${"00".repeat(32)}`,
    requestExpiresAtUnix: Math.floor(Date.now() / 1000) + 30,
  };
  const authority = await readGrantAuthority({
    envelope,
    owner,
    agent,
    deploymentId,
    nowMs: async () => Date.now(),
  });
  return {
    decision: authority.ok
      ? "ALLOW"
      : authority.unavailable
        ? "UNAVAILABLE"
        : "DENY",
    reasonCode: authority.ok ? "GRANT_VALID" : authority.reasonCode,
    checkedBlock: authority.checkedBlock,
    observedCreator: authority.observedCreator,
    ...(authority.ok ? { query: authority.query } : {}),
    grantKey,
    resource,
    mode: "Independent grant policy inspection; no HTTP side effect; no persistent high-water state",
  };
}
if (process.argv[1]?.endsWith("verify.ts")) {
  const { values } = parseArgs({
    options: { grant: { type: "string" }, resource: { type: "string" } },
  });
  try {
    const result = await verifyIndependent(
      values.grant ?? "",
      values.resource ?? "",
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.decision === "UNAVAILABLE") process.exitCode = 1;
  } catch {
    console.error(
      JSON.stringify({
        decision: "UNAVAILABLE",
        reasonCode: "INDEPENDENT_VERIFICATION_FAILED",
      }),
    );
    process.exitCode = 1;
  }
}
