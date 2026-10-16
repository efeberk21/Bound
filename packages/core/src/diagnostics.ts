// Do not serialize arbitrary errors: messages, causes and stacks may contain
// credentials, signed bytes or credential-bearing endpoints.
export function logFailure(context: string, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const category =
    code === "23505"
      ? "DATABASE_CONFLICT"
      : code === "23503"
        ? "DATABASE_REFERENCE"
        : code === "23514"
          ? "DATABASE_CONSTRAINT"
          : code.startsWith("08")
            ? "DATABASE_CONNECTION"
            : "DEPENDENCY_OR_CONFIGURATION";
  console.error(
    JSON.stringify({ event: "operation_error", context, category }),
  );
}
