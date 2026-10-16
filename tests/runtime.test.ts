import { beforeEach, expect, it, vi } from "vitest";
import { startSession } from "../packages/core/src/runtime.js";
const state = vi.hoisted(() => ({ calls: 0, failCreate: false }));
vi.mock("../packages/core/src/db.js", () => ({
  database: () => async () => {
    state.calls++;
    if (state.calls === 1) {
      if (state.failCreate) throw new Error("Creation failed");
      return [{ expires_at: new Date(Date.now() + 300000).toISOString() }];
    }
    throw new Error("Housekeeping unavailable: secret credentials");
  },
}));
beforeEach(() => {
  state.calls = 0;
  state.failCreate = false;
});
it("returns a committed session even if optional housekeeping fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await startSession("cleanup-test", {
      atlas: { title: "Atlas", body: "Source" },
      boreal: { title: "Boreal", body: "Source" },
    });
    expect(result?.runId).toMatch(/^[a-f0-9-]{36}$/);
    expect(state.calls).toBe(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret credentials");
  } finally {
    log.mockRestore();
  }
});
it("does not turn a session creation failure into a success", async () => {
  state.failCreate = true;
  await expect(
    startSession("cleanup-test", {
      atlas: { title: "Atlas", body: "Source" },
      boreal: { title: "Boreal", body: "Source" },
    }),
  ).rejects.toThrow("Creation failed");
});
