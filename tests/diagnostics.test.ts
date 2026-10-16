import { expect, it, vi } from "vitest";
import { logFailure } from "../packages/core/src/diagnostics.js";
it("logs only classified fields even when an error carries secrets and raw transactions", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    logFailure("chain.test", {
      code: "23505",
      message: "password=secret",
      stack: "raw transaction and credentials",
      cause: { secret: "secret" },
    });
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "operation_error",
        context: "chain.test",
        category: "DATABASE_CONFLICT",
      }),
    );
  } finally {
    log.mockRestore();
  }
});
