import { getIronSession } from "iron-session";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { configuration } from "./config.js";
import { database } from "./db.js";

export function browserOriginAllowed(request: IncomingMessage) {
  return request.headers.origin === configuration().origin;
}
export async function cookieSession(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const config = configuration();
  return getIronSession<{ runId?: string; deploymentId?: string }>(
    request,
    response,
    {
      cookieName: "bound_demo",
      password: config.sessionSecret,
      ttl: 300,
      cookieOptions: {
        maxAge: 300,
        httpOnly: true,
        secure: config.origin.startsWith("https://"),
        sameSite: "strict",
        path: "/",
      },
    },
  );
}
export async function activeSession(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const config = configuration();
  const cookie = await cookieSession(request, response);
  if (
    !z.uuid().safeParse(cookie.runId).success ||
    cookie.deploymentId !== config.deploymentId
  )
    return null;
  const sql = database();
  const rows =
    await sql`SELECT run_id,expires_at,model_calls FROM sessions WHERE run_id=${cookie.runId!}::uuid
    AND deployment_id=${config.deploymentId} AND expires_at>clock_timestamp()`;
  return rows[0]
    ? {
        runId: String(rows[0].run_id),
        expiresAt: new Date(String(rows[0].expires_at)).toISOString(),
        modelCalls: Number(rows[0].model_calls),
      }
    : null;
}
