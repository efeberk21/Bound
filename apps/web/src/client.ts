import { z } from "zod";

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The response was interrupted. Refresh state or use Resume to check pending work.",
    );
  }
  if (!response.ok) {
    const failure = z
      .object({
        message: z.string().optional(),
        error: z.string().optional(),
        reasonCode: z.string().optional(),
      })
      .safeParse(data);
    throw new Error(
      failure.success
        ? (failure.data.message ??
          failure.data.error ??
          failure.data.reasonCode ??
          "Unable to complete this request.")
        : "Unable to complete this request.",
    );
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new Error(
      "Server response could not be validated. Refresh to recover.",
    );
  return parsed.data;
}
