import { rawBody, safeHandler, send } from "../packages/core/src/http.js";
import {
  activeSession,
  browserOriginAllowed,
} from "../packages/core/src/session.js";
import { configuration } from "../packages/core/src/config.js";
import { database } from "../packages/core/src/db.js";
import { signedCall } from "../packages/core/src/runner.js";
import { transformContentReply } from "../packages/core/src/transform.js";
import { runModeSchema } from "../packages/core/src/api-contracts.js";
import { projectSchema } from "../packages/core/src/contracts.js";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { z } from "zod";

export default safeHandler(async (request, response) => {
  if (request.method !== "POST") {
    send(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }
  if (!browserOriginAllowed(request)) {
    send(response, 403, { error: "ORIGIN_DENIED" });
    return;
  }
  const session = await activeSession(request, response);
  if (!session) {
    send(response, 403, { error: "SESSION_REQUIRED" });
    return;
  }
  const schema = z
    .object({
      project: projectSchema,
      mode: runModeSchema,
    })
    .strict();
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(
      JSON.parse((await rawBody(request)).toString("utf8")),
    );
  } catch {
    send(response, 400, { error: "INVALID_PAYLOAD" });
    return;
  }
  if (parsed.mode === "ai") {
    send(response, 503, {
      error: "AI_UNAVAILABLE",
      message: "Free model access has not been verified.",
    });
    return;
  }
  const config = configuration();
  const sql = database();
  const test = ["wrong-project", "forged", "expiry", "check"].includes(
    parsed.mode,
  );
  const grantProject = ["wrong-project", "forged", "expiry"].includes(
    parsed.mode,
  )
    ? "atlas"
    : parsed.project;
  const targetProject =
    parsed.mode === "wrong-project" ? "boreal" : grantProject;
  const resource = `demo://bound/${session.runId}/${targetProject}`;
  const grantResource = `demo://bound/${session.runId}/${grantProject}`;
  const grantOperation =
    parsed.mode === "forged"
      ? "forged"
      : parsed.mode === "expiry"
        ? "expiry"
        : "grant";
  const grants =
    await sql`SELECT entity_key FROM chain_operations WHERE run_id=${session.runId}::uuid AND resource=${grantResource}
    AND operation=${grantOperation} AND status='confirmed'`;
  if (!grants[0]?.entity_key) {
    send(response, 409, { error: "GRANT_NOT_CONFIRMED" });
    return;
  }
  const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
  const common = {
    account,
    deploymentId: config.deploymentId,
    resource,
    grantKey: grants[0].entity_key as Hex,
  };
  // These are direct executor HTTP calls. There is no control authorization call.
  const contentUrl = `${config.origin}/api/content`;
  const previewUrl = `${config.origin}/api/preview`;
  const before =
    await sql`SELECT title,body,revision FROM previews WHERE run_id=${session.runId}::uuid AND project=${targetProject}`;
  const results: Record<string, unknown>[] = [];
  let preview = {
    title: "Permission boundary test",
    body: "Synthetic write used to inspect this grant’s permission boundary.",
  };
  if (!test) {
    const read = await (
      await signedCall({
        ...common,
        url: contentUrl,
        serviceId: "bound.content.v1",
      })
    ).call();
    results.push(read);
    if (read.decision !== "ALLOW") {
      send(response, 200, {
        mode: parsed.mode,
        project: targetProject,
        results,
        before: before[0],
      });
      return;
    }
    try {
      preview = transformContentReply(read);
    } catch {
      send(response, 502, {
        error: "CONTENT_RESPONSE_INVALID",
        message:
          "Content could not be validated. No preview write was attempted.",
      });
      return;
    }
  }
  const update = await signedCall({
    ...common,
    url: previewUrl,
    serviceId: "bound.preview.v1",
    preview,
  });
  results.push(await update.call());
  if (parsed.mode === "replay") results.push(await update.call());
  if (test) {
    const read = await (
      await signedCall({
        ...common,
        url: contentUrl,
        serviceId: "bound.content.v1",
      })
    ).call();
    results.unshift(read);
  }
  const after =
    await sql`SELECT title,body,revision FROM previews WHERE run_id=${session.runId}::uuid AND project=${targetProject}`;
  send(response, 200, {
    mode: parsed.mode,
    project: targetProject,
    results,
    before: before[0],
    after: after[0],
  });
});
