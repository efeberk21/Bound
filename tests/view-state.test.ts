import { describe, expect, it } from "vitest";
import {
  operationAction,
  projectStatus,
  sessionUsable,
  type Operation,
  type Result,
} from "../apps/web/src/view-state.js";
const grant: Operation = {
  id: "public-id",
  resource: "atlas",
  operation: "grant",
  status: "confirmed",
  txHash: "hash",
  entityKey: "main-grant",
  block: "10",
  errorCode: null,
  retryable: false,
};
const result: Result = {
  decision: "ALLOW",
  serviceId: "bound.preview.v1",
  reasonCode: "GRANT_VALID",
  grantKey: "main-grant",
  checkedAt: new Date().toISOString(),
  requestId: "test",
};
describe("UI operation recovery and observed permission state", () => {
  it.each(["preparing", "prepared", "submitted"] as const)(
    "exposes Resume for %s",
    (status) => {
      expect(operationAction({ ...grant, status }, "Grant access")).toEqual({
        label: "Resume grant access",
        disabled: false,
      });
    },
  );
  it("retries failed unsigned work but does not reconstruct signed failures", () => {
    expect(
      operationAction(
        { ...grant, status: "failed", retryable: true },
        "Grant access",
      ).disabled,
    ).toBe(false);
    expect(
      operationAction({ ...grant, status: "failed" }, "Grant access").disabled,
    ).toBe(true);
  });
  it("invalidates local availability exactly at expiry", () => {
    const session = { expiresAt: new Date(300000).toISOString() };
    expect(sessionUsable(session, 240000)).toBe(true);
    expect(sessionUsable(session, 300000)).toBe(false);
    expect(projectStatus({ usable: false, grant, results: [result] })).toBe(
      "Session unavailable",
    );
  });
  it("separates transaction confirmation from last service observations", () => {
    expect(projectStatus({ usable: true, grant, results: [] })).toBe(
      "Grant confirmed",
    );
    expect(projectStatus({ usable: true, grant, results: [result] })).toBe(
      "Last checks allowed",
    );
    expect(
      projectStatus({
        usable: true,
        grant,
        results: [{ ...result, decision: "DENY" }],
      }),
    ).toBe("Last checks denied");
  });
  it("does not let a different grant change the main task status", () => {
    expect(
      projectStatus({
        usable: true,
        grant,
        results: [{ ...result, grantKey: "expiry-grant" }],
      }),
    ).toBe("Grant confirmed");
  });
  it("preserves confirmed revocation after a refresh with no in-memory service observations", () => {
    expect(
      projectStatus({
        usable: true,
        grant,
        revoke: { ...grant, operation: "revoke" },
        results: [],
      }),
    ).toBe("Revoked on chain");
  });
});
