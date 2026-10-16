import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { signedCall } from "../packages/core/src/runner.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const observations = JSON.parse(
  await readFile(
    process.env.BOUND_LIVE_RESULTS_FILE || ".local/live-results.json",
    "utf8",
  ),
) as Record<string, unknown>[];
const grant = observations.find(
  (row) =>
    row.operation === "grant" && String(row.resource).endsWith("/boreal"),
);
if (!grant) throw new Error("FRESH_BOREAL_GRANT_REQUIRED");
const origin = process.env.BOUND_TEST_ORIGIN || process.env.PUBLIC_ORIGIN!;
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const samples = [];
for (let sample = 1; sample <= 3; sample++) {
  const start = performance.now();
  const call = await signedCall({
    account,
    deploymentId: process.env.DEPLOYMENT_ID!,
    url: origin + "/api/content",
    serviceId: "bound.content.v1",
    resource: String(grant.resource),
    grantKey: grant.entityKey as Hex,
  });
  const result = await call.call();
  samples.push({
    sample,
    durationMs: Math.round(performance.now() - start),
    decision: result.decision,
    checkedBlock: result.checkedBlock,
    checkedAt: result.checkedAt,
  });
  if (result.decision !== "ALLOW")
    throw new Error("MEASUREMENT_NOT_AUTHORIZED");
}
const result = {
  mode: "measurement",
  environment: `${process.platform} ${process.version} client -> ${new URL(origin).origin} -> Arkiv/Neon`,
  nodeVersion: process.version,
  platform: process.platform,
  origin: new URL(origin).origin,
  metric:
    "Challenge issuance + EIP-712 signing + content verification HTTP round-trip; three individual samples, no SLA",
  samples,
};
await writeFile(".local/measurements.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
