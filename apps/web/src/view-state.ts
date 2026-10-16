export type {
  PublicOperation as Operation,
  ToolDecision as Result,
} from "../../../packages/core/src/api-contracts.js";
import type {
  PublicOperation as Operation,
  ToolDecision as Result,
} from "../../../packages/core/src/api-contracts.js";
export function sessionUsable(
  session: { expiresAt: string } | null | undefined,
  now: number,
) {
  return !!session && Date.parse(session.expiresAt) > now;
}
export function operationAction(op: Operation | undefined, label: string) {
  if (!op) return { label, disabled: false };
  if (op.status === "confirmed") return { label, disabled: true };
  if (op.status === "failed")
    return { label: `Retry ${label.toLowerCase()}`, disabled: !op.retryable };
  return { label: `Resume ${label.toLowerCase()}`, disabled: false };
}
export function projectStatus(input: {
  usable: boolean;
  grant?: Operation | undefined;
  revoke?: Operation | undefined;
  results: Result[];
}) {
  if (!input.usable) return "Session unavailable";
  if (!input.grant) return "Not granted";
  if (input.grant.status === "failed") return "Grant failed";
  if (input.grant.status !== "confirmed") return "Grant pending";
  if (input.revoke?.status === "confirmed") return "Revoked on chain";
  if (input.revoke?.status === "failed") return "Revoke failed";
  if (input.revoke) return "Revocation pending";
  const relevant = input.results.filter(
    (r) => r.grantKey === input.grant!.entityKey,
  );
  if (relevant.some((r) => r.decision === "UNAVAILABLE"))
    return "Unable to verify";
  if (relevant.some((r) => r.decision === "DENY")) return "Last checks denied";
  return relevant.length ? "Last checks allowed" : "Grant confirmed";
}
