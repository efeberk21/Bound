import { z } from "zod";
import {
  addressSchema,
  keySchema,
  previewSchema,
  projectSchema,
  resourceSchema,
} from "./contracts.js";

export const chainOperationSchema = z.enum([
  "grant",
  "revoke",
  "forged",
  "expiry",
]);
export const chainStatusSchema = z.enum([
  "preparing",
  "prepared",
  "submitted",
  "confirmed",
  "failed",
]);
export const runModeSchema = z.enum([
  "deterministic",
  "ai",
  "wrong-project",
  "forged",
  "replay",
  "expiry",
  "check",
]);
export const sessionResponseSchema = z
  .object({
    runId: z.uuid(),
    expiresAt: z.iso.datetime(),
    modelCalls: z.number().int().min(0).max(2),
  })
  .strict();
export const publicOperationSchema = z
  .object({
    id: z.uuid(),
    resource: resourceSchema,
    operation: chainOperationSchema,
    status: chainStatusSchema,
    txHash: keySchema.nullable(),
    entityKey: keySchema.nullable(),
    block: z.string().regex(/^\d+$/).nullable(),
    errorCode: z.string().nullable(),
    retryable: z.boolean(),
  })
  .strict();
export const sourceContentSchema = z
  .object({
    title: z.string().trim().min(1).max(400),
    body: z.string().trim().min(1).max(20000),
  })
  .strict();
export const storedPreviewSchema = previewSchema
  .extend({ revision: z.number().int().nonnegative() })
  .strict();
export const projectPreviewSchema = storedPreviewSchema
  .extend({ project: projectSchema })
  .strict();
export const toolDecisionSchema = z
  .object({
    decision: z.enum(["ALLOW", "DENY", "UNAVAILABLE"]),
    reasonCode: z.string().min(1),
    serviceId: z.enum(["bound.content.v1", "bound.preview.v1"]),
    grantKey: z.union([keySchema, z.literal("")]),
    checkedBlock: z.string().regex(/^\d+$/).optional(),
    checkedAt: z.iso.datetime(),
    observedCreator: addressSchema.optional(),
    requestId: z.uuid(),
    httpStatus: z.number().int().optional(),
    content: sourceContentSchema.optional(),
    preview: storedPreviewSchema.optional(),
  })
  .strict();
export const runResponseSchema = z
  .object({
    mode: runModeSchema,
    project: projectSchema,
    results: z.array(toolDecisionSchema).min(1).max(3),
    before: storedPreviewSchema.optional(),
    after: storedPreviewSchema.optional(),
  })
  .strict();
export const stateResponseSchema = z
  .object({
    session: sessionResponseSchema.nullable(),
    owner: addressSchema,
    agent: addressSchema,
    deploymentId: z.string().min(1).optional(),
    aiAvailable: z.boolean(),
    previews: z.array(projectPreviewSchema).optional(),
    operations: z.array(publicOperationSchema).optional(),
  })
  .strict()
  .superRefine((state, ctx) => {
    if (
      state.session &&
      (!state.deploymentId || !state.previews || !state.operations)
    )
      ctx.addIssue({
        code: "custom",
        message: "Active session state is incomplete",
      });
  });
export type PublicOperation = z.infer<typeof publicOperationSchema>;
export type ToolDecision = z.infer<typeof toolDecisionSchema>;
export type RunResponse = z.infer<typeof runResponseSchema>;
export type StateResponse = z.infer<typeof stateResponseSchema>;
