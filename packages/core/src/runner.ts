import { keccak256, type Hex } from "viem";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { toolDecisionSchema } from "./api-contracts.js";
import type { PrivateKeyAccount } from "viem/accounts";
import { signRequest } from "./signing.js";
import {
  envelopeSchema,
  type Envelope,
  type Preview,
  type ServiceId,
} from "./contracts.js";

export async function signedCall(input: {
  account: PrivateKeyAccount;
  deploymentId: string;
  url: string;
  serviceId: ServiceId;
  resource: string;
  grantKey: Hex;
  preview?: Preview;
}) {
  const challengeResponse = await fetch(`${input.url}/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      resource: input.resource,
      agent: input.account.address,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!challengeResponse.ok) throw new Error("CHALLENGE_UNAVAILABLE");
  const challenge = z
    .object({
      nonce: envelopeSchema.shape.nonce,
      expiresAtUnix: z.number().int().positive(),
    })
    .strict()
    .parse(await challengeResponse.json());
  const action =
    input.serviceId === "bound.content.v1" ? "content.read" : "preview.update";
  // Serialize exactly once. The very same bytes are hashed and sent.
  const raw = Buffer.from(
    JSON.stringify({
      resource: input.resource,
      action,
      ...(input.preview ?? {}),
    }),
  );
  const envelope: Envelope = envelopeSchema.parse({
    serviceId: input.serviceId,
    resource: input.resource,
    action,
    grantKey: input.grantKey,
    bodyHash: keccak256(raw),
    nonce: challenge.nonce,
    requestExpiresAtUnix: challenge.expiresAtUnix,
  });
  const signature = await signRequest(
    input.account,
    input.deploymentId,
    envelope,
  );
  const headers = {
    "content-type": "application/json",
    "x-bound-request": Buffer.from(JSON.stringify(envelope)).toString(
      "base64url",
    ),
    "x-bound-signature": signature,
  };
  const call = async (
    url = input.url,
  ): Promise<Record<string, unknown> & { httpStatus: number }> => {
    const response = await fetch(`${url}/execute`, {
      method: "POST",
      headers,
      body: raw,
      signal: AbortSignal.timeout(20000),
    });
    const reply: unknown = await response.json();
    const parsed = toolDecisionSchema.safeParse(reply);
    if (parsed.success) return { ...parsed.data, httpStatus: response.status };
    const failure = z
      .object({
        decision: z.enum(["DENY", "UNAVAILABLE"]),
        reasonCode: z.string().min(1),
      })
      .safeParse(reply);
    return {
      httpStatus: response.status,
      decision: failure.success ? failure.data.decision : "UNAVAILABLE",
      reasonCode: failure.success
        ? failure.data.reasonCode
        : "EXECUTOR_RESPONSE_INVALID",
      serviceId: input.serviceId,
      grantKey: input.grantKey,
      checkedAt: new Date().toISOString(),
      requestId: randomUUID(),
    };
  };
  return { call, envelope };
}
