import { database } from "../packages/core/src/db.js";
import {
  operation,
  rawBody,
  safeHandler,
  send,
} from "../packages/core/src/http.js";
import { configuration } from "../packages/core/src/config.js";
import {
  activeSession,
  browserOriginAllowed,
  cookieSession,
} from "../packages/core/src/session.js";
import { startSession } from "../packages/core/src/runtime.js";
import {
  requestChainOperation,
  resumeChainOperation,
  publicOperation,
  type ChainState,
} from "../packages/core/src/chain.js";
import { projectSchema } from "../packages/core/src/contracts.js";
import { logFailure } from "../packages/core/src/diagnostics.js";
import { stateResponseSchema } from "../packages/core/src/api-contracts.js";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { z } from "zod";
import atlas from "../fixtures/atlas.json" with { type: "json" };
import boreal from "../fixtures/boreal.json" with { type: "json" };
export default safeHandler(async (request, response) => {
  const op = operation(request);
  const sql = database();
  if (request.method === "GET" && op === "health") {
    await sql`SELECT 1 AS connected`;
    send(response, 200, {
      service: "control",
      stage: "implementation",
      database: "reachable",
    });
    return;
  }
  const config = configuration();
  if (request.method === "POST" && !browserOriginAllowed(request)) {
    send(response, 403, { error: "ORIGIN_DENIED" });
    return;
  }
  let session = await activeSession(request, response);
  if (request.method === "POST" && op === "start") {
    if (!session) {
      const created = await startSession(config.deploymentId, {
        atlas,
        boreal,
      });
      if (!created) {
        send(response, 409, {
          error: "SHARED_DEMO_BUSY",
          message: "Shared demo is busy. Try again within five minutes.",
        });
        return;
      }
      const cookie = await cookieSession(request, response);
      cookie.runId = created.runId;
      cookie.deploymentId = config.deploymentId;
      await cookie.save();
      session = { ...created, modelCalls: 0 };
    }
    send(response, 200, session);
    return;
  }
  if (request.method === "GET" && op === "state") {
    const agent = privateKeyToAccount(
      process.env.AGENT_PRIVATE_KEY as Hex,
    ).address;
    if (!session) {
      send(response, 200, {
        session: null,
        owner: config.owner,
        agent,
        aiAvailable: false,
      });
      return;
    }
    const previews =
      await sql`SELECT project,title,body,revision FROM previews WHERE run_id=${session.runId}::uuid`;
    const ops =
      await sql`SELECT * FROM chain_operations WHERE run_id=${session.runId}::uuid ORDER BY created_at`;
    send(
      response,
      200,
      stateResponseSchema.parse({
        session,
        owner: config.owner,
        agent,
        deploymentId: config.deploymentId,
        aiAvailable: false,
        previews,
        operations: ops.map((row) => publicOperation(row as ChainState)),
      }),
    );
    return;
  }
  if (!session) {
    send(response, 403, { error: "SESSION_REQUIRED" });
    return;
  }
  if (request.method !== "POST") {
    send(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }
  let body: unknown;
  try {
    body = JSON.parse((await rawBody(request)).toString("utf8"));
  } catch {
    send(response, 400, { error: "INVALID_PAYLOAD" });
    return;
  }
  if (op === "status") {
    const parsed = z.object({ id: z.uuid() }).strict().safeParse(body);
    if (!parsed.success) {
      send(response, 400, { error: "INVALID_PAYLOAD" });
      return;
    }
    const rows =
      await sql`SELECT * FROM chain_operations WHERE id=${parsed.data.id}::uuid AND run_id=${session.runId}::uuid`;
    if (!rows[0]) {
      send(response, 404, { error: "NOT_FOUND" });
      return;
    }
    send(
      response,
      200,
      publicOperation(await resumeChainOperation(rows[0] as ChainState)),
    );
    return;
  }
  if (!["grant", "revoke", "forged", "expiry"].includes(op)) {
    send(response, 404, { error: "NOT_FOUND" });
    return;
  }
  const parsed = z.object({ project: projectSchema }).strict().safeParse(body);
  if (!parsed.success) {
    send(response, 400, { error: "INVALID_PAYLOAD" });
    return;
  }
  const resource = `demo://bound/${session.runId}/${parsed.data.project}`;
  const agent = privateKeyToAccount(
    process.env.AGENT_PRIVATE_KEY as Hex,
  ).address;
  let entityKey: Hex | undefined;
  if (op === "revoke") {
    const grants =
      await sql`SELECT entity_key FROM chain_operations WHERE run_id=${session.runId}::uuid AND resource=${resource} AND operation='grant' AND status='confirmed'`;
    if (!grants[0]?.entity_key) {
      send(response, 409, { error: "GRANT_NOT_CONFIRMED" });
      return;
    }
    entityKey = grants[0].entity_key as Hex;
  }
  if ((op === "forged" || op === "expiry") && parsed.data.project !== "atlas") {
    send(response, 400, { error: "WRONG_SCOPE" });
    return;
  }
  try {
    const row = await requestChainOperation({
      resource,
      operation: op as "grant" | "revoke" | "forged" | "expiry",
      agent,
      deploymentId: config.deploymentId,
      ...(entityKey ? { entityKey } : {}),
    });
    send(response, 200, publicOperation(row));
  } catch (error) {
    logFailure("control.chain", error);
    const busy = error instanceof Error && error.message === "SIGNER_BUSY";
    send(response, busy ? 409 : 503, {
      error: busy ? "SIGNER_BUSY" : "CHAIN_UNAVAILABLE",
    });
  }
});
