import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { api } from "../apps/web/src/client.js";
import {
  publicOperationSchema,
  stateResponseSchema,
} from "../packages/core/src/api-contracts.js";
const operation = {
  id: randomUUID(),
  resource: `demo://bound/${randomUUID()}/atlas`,
  operation: "grant",
  status: "submitted",
  txHash: `0x${"11".repeat(32)}`,
  entityKey: null,
  block: null,
  errorCode: null,
  retryable: false,
};
afterEach(() => vi.unstubAllGlobals());
describe("shared response schemas at the browser boundary", () => {
  it("rejects unknown transaction states instead of trusting a cast", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...operation, status: "active" }),
    );
    await expect(
      api("/api/control/status", publicOperationSchema, { id: operation.id }),
    ).rejects.toThrow("could not be validated");
  });
  it("rejects internal secret fields in a public operation", () => {
    expect(
      publicOperationSchema.safeParse({
        ...operation,
        raw_transaction: "private signed bytes",
      }).success,
    ).toBe(false);
  });
  it("requires previews and operations for an active session", () => {
    expect(
      stateResponseSchema.safeParse({
        session: {
          runId: randomUUID(),
          expiresAt: new Date().toISOString(),
          modelCalls: 0,
        },
        owner: `0x${"11".repeat(20)}`,
        agent: `0x${"22".repeat(20)}`,
        aiAvailable: false,
      }).success,
    ).toBe(false);
  });
  it("preserves a concrete server error and validates successful state", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "SIGNER_BUSY" }, { status: 409 }),
    );
    await expect(
      api("/api/control/grant", publicOperationSchema, {}),
    ).rejects.toThrow("SIGNER_BUSY");
    vi.stubGlobal("fetch", async () => Response.json(operation));
    expect(
      await api("/api/control/status", publicOperationSchema, {
        id: operation.id,
      }),
    ).toEqual(operation);
  });
});
