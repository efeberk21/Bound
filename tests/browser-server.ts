// Local QA adapter only. Serves the real app/handlers/DB and injects one unsigned
// preparation failure and one lost grant response. Never included in deployment.
import { createServer, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer } from "vite";
import control from "../api/control.js";
import content from "../api/content.js";
import preview from "../api/preview.js";
import run from "../api/run.js";
import { database } from "../packages/core/src/db.js";
import { configuration } from "../packages/core/src/config.js";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DEPLOYMENT_ID?.startsWith("bound-browser-test-"))
  throw new Error("ISOLATED_TEST_DEPLOYMENT_REQUIRED");
const config = configuration(),
  sql = database();
const routes = { control, content, preview, run };
const events: unknown[] = [];
let output = Promise.resolve(),
  seeded = false,
  dropped = false;
function record(value: unknown) {
  events.push(value);
  output = output.then(() =>
    writeFile(
      ".local/audit/browser-recovery.json",
      JSON.stringify(events, null, 2),
    ),
  );
}
await mkdir(".local/audit", { recursive: true });
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const name = path.split("/")[2] as keyof typeof routes;
  const handler = routes[name];
  if (!handler) {
    response.writeHead(404).end();
    return;
  }
  const end = response.end.bind(response);
  response.end = ((chunk?: string | Uint8Array) => {
    void (async () => {
      const now = new Date().toISOString();
      record({
        path,
        method: request.method,
        at: now,
        status: response.statusCode,
        cookiePresent: !!request.headers.cookie?.includes("bound_demo="),
      });
      if (
        path === "/api/control/start" &&
        response.statusCode === 200 &&
        !seeded
      ) {
        const session = JSON.parse(String(chunk)) as {
          runId: string;
          expiresAt: string;
        };
        const id = randomUUID();
        await sql`INSERT INTO chain_operations(id,run_id,resource,operation,signer,status,claim_token,error_code)
          VALUES (${id}::uuid,${session.runId}::uuid,${`demo://bound/${session.runId}/atlas`},'grant',${config.owner.toLowerCase()},
            'failed',${randomUUID()}::uuid,'PREPARATION_UNAVAILABLE')`;
        seeded = true;
        record({
          event: "seeded_unsigned_failure",
          id,
          runId: session.runId,
          expiresAt: session.expiresAt,
          at: now,
        });
      }
      if (
        path === "/api/control/grant" &&
        response.statusCode === 200 &&
        !dropped
      ) {
        dropped = true;
        const operation = JSON.parse(String(chunk)) as {
          id: string;
          status: string;
        };
        record({
          event: "dropped_grant_response",
          id: operation.id,
          status: operation.status,
          at: now,
        });
        response.destroy();
        return;
      }
      end(chunk);
    })().catch(() => {
      response.destroy();
    });
    return response;
  }) as ServerResponse["end"];
  void handler(request, response);
});
server.listen(3001, "127.0.0.1");
const vite = await createViteServer({ root: "apps/web" });
await vite.listen();
vite.printUrls();
function stop() {
  server.close();
  void vite.close();
  void output;
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
