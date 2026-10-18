import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, type Hex } from "viem";
import { signedCall } from "../packages/core/src/runner.js";
import { signRequest } from "../packages/core/src/signing.js";
import { transformContentReply } from "../packages/core/src/transform.js";
import {
  publicOperationSchema,
  runResponseSchema,
  stateResponseSchema,
  type PublicOperation,
  type RunResponse,
} from "../packages/core/src/api-contracts.js";
import type { Envelope } from "../packages/core/src/contracts.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const origin = process.env.BOUND_TEST_ORIGIN || process.env.PUBLIC_ORIGIN!;
let cookie = "",
  atlasGrant: PublicOperation,
  borealGrant: PublicOperation;
const records: unknown[] = [];
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
async function call(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return result;
}
async function chain(
  operation: PublicOperation["operation"],
  project = "atlas",
) {
  let result = publicOperationSchema.parse(
    await call(`/api/control/${operation}`, { project }),
  );
  for (
    let attempt = 0;
    attempt < 25 && !["confirmed", "failed"].includes(result.status);
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    result = publicOperationSchema.parse(
      await call("/api/control/status", { id: result.id }),
    );
  }
  records.push(result);
  expect(result.status).toBe("confirmed");
  return result;
}
async function run(project: string, mode: RunResponse["mode"]) {
  const result = runResponseSchema.parse(
    await call("/api/run", { project, mode }),
  );
  records.push(result);
  return result;
}
const decisions = (result: RunResponse) =>
  result.results.map((row) => row.decision);
async function preview(project = "atlas") {
  const state = stateResponseSchema.parse(await call("/api/control/state"));
  return state.previews!.find((row) => row.project === project)!;
}
const common = (grant: PublicOperation) => ({
  account,
  deploymentId: process.env.DEPLOYMENT_ID!,
  resource: grant.resource,
  grantKey: grant.entityKey as Hex,
});
async function worker(dropResponse = false) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/http-worker.ts"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BOUND_TEST_DROP_EXECUTE_RESPONSE: dropResponse ? "1" : "0",
      },
    },
  );
  const url = await new Promise<string>((resolve, reject) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.includes("\n")) {
        try {
          resolve((JSON.parse(output.split("\n")[0]!) as { url: string }).url);
        } catch {
          reject(new Error("Worker startup failed"));
        }
      }
    });
    child.on("error", reject);
    child.on("exit", () => reject(new Error("Worker exited")));
  });
  return { url, stop: () => child.kill() };
}
function scenario(name: string, work: () => Promise<void>, timeout = 90000) {
  it(
    name,
    async () => {
      try {
        await work();
        records.push({ mode: "scenario", name, outcome: "passed" });
      } catch (error) {
        records.push({ mode: "scenario", name, outcome: "failed" });
        throw error;
      }
    },
    timeout,
  );
}
describe.sequential("Live Tiramisu + HTTP + real Neon", () => {
  beforeAll(async () => {
    const session = (await call("/api/control/start", {})) as { runId: string };
    records.push({
      runId: session.runId,
      mode: "environment",
      nodeVersion: process.version,
      platform: process.platform,
      origin: new URL(origin).origin,
    });
    atlasGrant = await chain("grant");
    borealGrant = await chain("grant", "boreal");
  }, 90000);
  afterAll(async () => {
    const resultsPath = process.env.BOUND_LIVE_RESULTS_FILE || ".local/live-results.json";
    await mkdir(dirname(resultsPath), { recursive: true });
    await writeFile(
      resultsPath,
      JSON.stringify(records, null, 2),
    );
  });
  scenario(
    "T01: real Content response determines the stored preview",
    async () => {
      const result = await run("atlas", "deterministic");
      expect(decisions(result)).toEqual(["ALLOW", "ALLOW"]);
      expect(result.after!.revision).toBe(result.before!.revision + 1);
      expect({ title: result.after!.title, body: result.after!.body }).toEqual(
        transformContentReply(result.results[0]),
      );
    },
  );
  scenario(
    "T04/T05/T16: wrong agent and body/resource/action/domain tampering never write",
    async () => {
      const before = await preview();
      for (const mutation of [
        "agent",
        "body",
        "resource",
        "action",
        "deployment",
      ] as const) {
        const signer =
          mutation === "agent"
            ? privateKeyToAccount(generatePrivateKey())
            : account;
        const challenge = (await fetch(origin + "/api/preview/challenge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resource: atlasGrant.resource,
            agent: signer.address,
          }),
        }).then((response) => response.json())) as {
          nonce: Hex;
          expiresAtUnix: number;
        };
        const body = {
          resource: atlasGrant.resource,
          action: "preview.update",
          title: "Must not write",
          body: "Tampered request",
        };
        const raw = JSON.stringify(body);
        const envelope: Envelope = {
          serviceId: "bound.preview.v1",
          resource: atlasGrant.resource,
          action: "preview.update",
          grantKey: atlasGrant.entityKey!,
          bodyHash: keccak256(Buffer.from(raw)),
          nonce: challenge.nonce,
          requestExpiresAtUnix: challenge.expiresAtUnix,
        };
        const signature = await signRequest(
          signer,
          process.env.DEPLOYMENT_ID! +
            (mutation === "deployment" ? "-wrong" : ""),
          envelope,
        );
        const changed =
          mutation === "body"
            ? raw + " "
            : mutation === "resource"
              ? JSON.stringify({ ...body, resource: borealGrant.resource })
              : mutation === "action"
                ? JSON.stringify({ ...body, action: "content.read" })
                : raw;
        const response = await fetch(origin + "/api/preview/execute", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-bound-request": Buffer.from(JSON.stringify(envelope)).toString(
              "base64url",
            ),
            "x-bound-signature": signature,
          },
          body: changed,
        });
        const result = (await response.json()) as {
          decision: string;
          reasonCode: string;
        };
        expect(result.decision).toBe("DENY");
        if (mutation === "agent") expect(result.reasonCode).toBe("WRONG_AGENT");
        records.push({ mode: `tamper-${mutation}`, results: [result] });
        expect(await preview()).toEqual(before);
      }
    },
  );
  scenario(
    "T07/T08: concurrent replay across processes and restart causes one update",
    async () => {
      const first = await worker(),
        second = await worker();
      try {
        const before = await preview();
        const request = await signedCall({
          ...common(atlasGrant),
          url: first.url,
          serviceId: "bound.preview.v1",
          preview: {
            title: "Concurrent test",
            body: "Only one update is allowed.",
          },
        });
        const results = await Promise.all([
          request.call(first.url),
          request.call(second.url),
        ]);
        records.push({ mode: "two-process-signed-concurrent", results });
        expect(
          results.filter((result) => result.decision === "ALLOW"),
        ).toHaveLength(1);
        expect((await preview()).revision).toBe(before.revision + 1);
        first.stop();
        const restarted = await worker();
        try {
          expect((await request.call(restarted.url)).decision).toBe("DENY");
        } finally {
          restarted.stop();
        }
      } finally {
        first.stop();
        second.stop();
      }
    },
  );
  scenario(
    "T08 response loss: committed write survives socket loss, restart and retry",
    async () => {
      const dropped = await worker(true);
      const before = await preview();
      const request = await signedCall({
        ...common(atlasGrant),
        url: dropped.url,
        serviceId: "bound.preview.v1",
        preview: {
          title: "Response lost",
          body: "The committed effect is recovered from state.",
        },
      });
      try {
        await expect(request.call()).rejects.toThrow();
      } finally {
        dropped.stop();
      }
      const after = await preview();
      expect(after.revision).toBe(before.revision + 1);
      const restarted = await worker();
      try {
        const denied = await request.call(restarted.url);
        expect(denied.decision).toBe("DENY");
        expect(await preview()).toEqual(after);
        records.push({
          mode: "response-loss-restart",
          before,
          after,
          results: [denied],
        });
      } finally {
        restarted.stop();
      }
    },
  );
  scenario(
    "T02: wrong-project requests leave the target unchanged",
    async () => {
      const result = await run("atlas", "wrong-project");
      expect(decisions(result)).toEqual(["DENY", "DENY"]);
      expect(
        result.results.every((row) => row.reasonCode === "WRONG_SCOPE"),
      ).toBe(true);
      expect(result.after).toEqual(result.before);
    },
  );
  scenario(
    "T03: actual attacker grant cannot impersonate the owner",
    async () => {
      await chain("forged");
      const result = await run("atlas", "forged");
      expect(decisions(result)).toEqual(["DENY", "DENY"]);
      expect(
        result.results.every((row) => row.reasonCode === "UNTRUSTED_CREATOR"),
      ).toBe(true);
      expect(result.after).toEqual(result.before);
    },
  );
  scenario(
    "T06: replay reads Content, then accepts one Preview write and rejects its duplicate",
    async () => {
      const result = await run("atlas", "replay");
      expect(decisions(result)).toEqual(["ALLOW", "ALLOW", "DENY"]);
      expect(result.after!.revision).toBe(result.before!.revision + 1);
    },
  );
  scenario(
    "T15/T09: read, revoke, then a new write denies without changing stored state",
    async () => {
      const precedingRead = await (
        await signedCall({
          ...common(atlasGrant),
          url: origin + "/api/content",
          serviceId: "bound.content.v1",
        })
      ).call();
      expect(precedingRead.decision).toBe("ALLOW");
      await chain("revoke");
      const before = await preview();
      const blockedUpdate = await (
        await signedCall({
          ...common(atlasGrant),
          url: origin + "/api/preview",
          serviceId: "bound.preview.v1",
          preview: { title: "Must not appear", body: "Revoked after read." },
        })
      ).call();
      expect(blockedUpdate.decision).toBe("DENY");
      expect(await preview()).toEqual(before);
      records.push({
        mode: "controlled-read-revoke-update",
        results: [precedingRead, blockedUpdate],
      });
      const result = await run("atlas", "check");
      expect(decisions(result)).toEqual(["DENY", "DENY"]);
      expect(result.after).toEqual(result.before);
    },
  );
  scenario(
    "T10/T18: same agent continues Boreal with management absent",
    async () => {
      await chain("revoke");
      const normal = await run("boreal", "deterministic");
      expect(decisions(normal)).toEqual(["ALLOW", "ALLOW"]);
      const tools = await worker();
      const base = tools.url.replace("/api/preview", "");
      try {
        expect((await fetch(base + "/api/control/health")).status).toBe(404);
        const results = [];
        for (const grant of [atlasGrant, borealGrant])
          for (const service of ["content", "preview"] as const) {
            const result = await (
              await signedCall({
                ...common(grant),
                url: `${base}/api/${service}`,
                serviceId: `bound.${service}.v1`,
                ...(service === "preview"
                  ? {
                      preview: {
                        title: "Independent tool",
                        body: "Management is unavailable.",
                      },
                    }
                  : {}),
              })
            ).call();
            expect(result.decision).toBe(
              grant === atlasGrant ? "DENY" : "ALLOW",
            );
            results.push(result);
          }
        records.push({ mode: "management-unavailable", results });
      } finally {
        tools.stop();
      }
    },
  );
  scenario("T19: forged cookie and session injection fail", async () => {
    const outsider = await fetch(origin + "/api/control/grant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        cookie: "bound_demo=forged",
      },
      body: JSON.stringify({ project: "atlas" }),
    });
    expect(outsider.status).toBe(403);
    const injected = await fetch(origin + "/api/run", {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify({
        project: "atlas",
        mode: "deterministic",
        run_id: randomUUID(),
      }),
    });
    expect(injected.status).toBe(400);
  });
  scenario(
    "T11: separate short-lived Atlas grant allows before expiry and denies after",
    async () => {
      await chain("expiry");
      const before = await run("atlas", "expiry");
      expect(decisions(before)).toEqual(["ALLOW", "ALLOW"]);
      await new Promise((resolve) => setTimeout(resolve, 65000));
      const after = await run("atlas", "expiry");
      expect(decisions(after)).toEqual(["DENY", "DENY"]);
      expect(after.after).toEqual(after.before);
    },
    120000,
  );
});
