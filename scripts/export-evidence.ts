import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
// Allowlist only public observations; never export .env, cookies, raw signed
// transactions, challenge nonces, headers or request signatures.
const probe = JSON.parse(await readFile(".local/arkiv-probe.json", "utf8")) as {
  runId: string;
  observations: Record<string, unknown>[];
};
const live = JSON.parse(
  await readFile(
    process.env.BOUND_LIVE_RESULTS_FILE || ".local/live-results.json",
    "utf8",
  ),
) as Record<string, unknown>[];
const permitted = [
  "id",
  "resource",
  "operation",
  "status",
  "txHash",
  "entityKey",
  "block",
  "errorCode",
  "query",
  "creator",
  "owner",
  "flags",
  "expiresAt",
  "payload",
  "deletedAbsent",
  "forgedCreator",
  "expectedOwner",
  "expiryPresent",
  "runId",
  "mode",
  "project",
  "results",
  "before",
  "after",
  "samples",
  "sample",
  "durationMs",
  "metric",
  "environment",
  "nodeVersion",
  "platform",
  "origin",
  "name",
  "outcome",
];
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            permitted.includes(key) ||
            [
              "schemaVersion",
              "chainId",
              "deploymentId",
              "agent",
              "permissions",
              "service",
              "action",
              "notAfterUnix",
              "delegation",
              "readonly",
              "permissionlessExtension",
              "raw",
              "decision",
              "reasonCode",
              "serviceId",
              "grantKey",
              "checkedBlock",
              "checkedAt",
              "observedCreator",
              "requestId",
              "httpStatus",
              "title",
              "body",
              "revision",
              "content",
              "preview",
            ].includes(key),
        )
        .map(([key, item]) => [key, sanitize(item)]),
    );
  return value;
}
let commit: string | null = null;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
let workingTreeDirty: boolean | null = null,
  sourceTreeHash: string | null = null;
try {
  workingTreeDirty =
    execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
  const paths = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .split("\0")
    .filter(
      (path) =>
        /^(api\/|apps\/web\/|packages\/|scripts\/|tests\/|migrations\/|\.github\/|fixtures\/|package(?:-lock)?\.json$|tsconfig\.json$|vercel\.json$|\.nvmrc$)/.test(
          path,
        ) && !path.includes("/dist/"),
    );
  const hash = createHash("sha256");
  for (const path of [...new Set(paths)].sort()) {
    hash.update(path + "\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  sourceTreeHash = hash.digest("hex");
} catch {}
await mkdir("docs", { recursive: true });
const measurements = await readFile(".local/measurements.json", "utf8")
  .then(JSON.parse)
  .catch(() => null);
await writeFile(
  "docs/evidence.json",
  JSON.stringify(
    {
      network: "Tiramisu",
      chainId: 7738577,
      commit,
      workingTreeDirty,
      sourceTreeHash,
      nodeVersion: process.version,
      exportedAt: new Date().toISOString(),
      lifecycle: sanitize(probe.observations),
      live: sanitize(live),
      measurements: sanitize(measurements),
    },
    null,
    2,
  ),
);
const grants = live.filter((row) => row.operation === "grant");
if (grants.length >= 2)
  await writeFile(
    ".local/independent-manifest.json",
    JSON.stringify(
      {
        grants: grants.map((row) => ({
          grantKey: row.entityKey,
          resource: row.resource,
          expected: String(row.resource).endsWith("/atlas") ? "DENY" : "ALLOW",
        })),
      },
      null,
      2,
    ),
  );
console.log(
  "Public evidence exported to docs/evidence.json; fresh independent manifest is local.",
);
