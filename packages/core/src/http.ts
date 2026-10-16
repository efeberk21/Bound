import type { IncomingMessage, ServerResponse } from "node:http";
import { logFailure } from "./diagnostics.js";
export type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;
export function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
export function operation(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://localhost");
  return (
    url.searchParams.get("operation") ?? url.pathname.split("/")[3] ?? "health"
  );
}
export async function rawBody(request: IncomingMessage): Promise<Buffer> {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new Error("INVALID_PAYLOAD");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 8192) throw new Error("INVALID_PAYLOAD");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
export function safeHandler(handler: Handler): Handler {
  return async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      logFailure("http.handler", error);
      if (!response.headersSent)
        send(response, 503, {
          decision: "UNAVAILABLE",
          reasonCode: "SERVICE_UNAVAILABLE",
        });
    }
  };
}
