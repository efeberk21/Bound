import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { cookieSession, activeSession } from "../packages/core/src/session.js";

const state = vi.hoisted(() => ({ runId: "", expiresAt: 0 }));
vi.mock("../packages/core/src/db.js", () => ({
  database: () => async () =>
    Date.now() < state.expiresAt
      ? [
          {
            run_id: state.runId,
            expires_at: new Date(state.expiresAt).toISOString(),
            model_calls: 0,
          },
        ]
      : [],
}));
const previous = { ...process.env };
let server: Server,
  origin = "";
describe("five-minute browser cookie and authoritative DB expiry", () => {
  beforeAll(async () => {
    state.runId = randomUUID();
    process.env.DEPLOYMENT_ID = "session-test";
    process.env.DEMO_OWNER_ADDRESS = `0x${"11".repeat(20)}`;
    process.env.DEMO_SESSION_SECRET =
      "test-secret-for-session-lifetime-1234567890";
    server = createServer((req, res) => {
      void (async () => {
        if (req.url === "/start") {
          const cookie = await cookieSession(req, res);
          cookie.runId = state.runId;
          cookie.deploymentId = "session-test";
          await cookie.save();
          res.end("started");
        } else {
          res.end(JSON.stringify({ session: await activeSession(req, res) }));
        }
      })();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test server");
    origin = `http://127.0.0.1:${address.port}`;
    process.env.PUBLIC_ORIGIN = origin;
  });
  afterAll(async () => {
    vi.useRealTimers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = previous;
  });
  it("issues Max-Age=300, remains usable after 240s, and denies at DB expiry even with a retained cookie", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    state.expiresAt = start + 300000;
    const response = await fetch(origin + "/start");
    await response.text();
    const header = response.headers.get("set-cookie")!;
    expect(header).toContain("Max-Age=300");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    const cookie = header.split(";")[0]!;
    for (const seconds of [240, 299]) {
      vi.setSystemTime(start + seconds * 1000);
      const reply = await fetch(origin, { headers: { cookie } });
      expect(
        ((await reply.json()) as { session: unknown }).session,
      ).not.toBeNull();
    }
    vi.setSystemTime(start + 300000);
    const expired = await fetch(origin, { headers: { cookie } });
    expect(((await expired.json()) as { session: unknown }).session).toBeNull();
    vi.useRealTimers();
  });
});
