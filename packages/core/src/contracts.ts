import { z } from 'zod';

export const CHAIN_ID = 7738577;
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const keySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const projectSchema = z.enum(['atlas', 'boreal']);
export const resourceSchema = z.string().regex(/^demo:\/\/bound\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(atlas|boreal)$/);
export const previewSchema = z.object({
  title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(600),
}).strict();
export const permissionSchema = z.union([
  z.object({ service: z.literal('bound.content.v1'), action: z.literal('content.read') }).strict(),
  z.object({ service: z.literal('bound.preview.v1'), action: z.literal('preview.update') }).strict(),
]);
export const grantSchema = z.object({
  schemaVersion: z.literal(1), chainId: z.literal(CHAIN_ID), deploymentId: z.string().min(1).max(100),
  resource: resourceSchema, agent: addressSchema,
  permissions: z.array(permissionSchema).min(1).max(2),
  notAfterUnix: z.number().int().positive().safe(), delegation: z.literal(false),
}).strict();
export const envelopeSchema = z.object({
  serviceId: z.enum(['bound.content.v1', 'bound.preview.v1']), resource: resourceSchema,
  action: z.enum(['content.read', 'preview.update']), grantKey: keySchema, bodyHash: keySchema,
  nonce: keySchema, requestExpiresAtUnix: z.number().int().positive().safe(),
}).strict();
export const contentBodySchema = z.object({ resource: resourceSchema, action: z.literal('content.read') }).strict();
export const previewBodySchema = previewSchema.extend({ resource: resourceSchema, action: z.literal('preview.update') }).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type Grant = z.infer<typeof grantSchema>;
export type ServiceId = Envelope['serviceId'];
export type Project = z.infer<typeof projectSchema>;
export type Preview = z.infer<typeof previewSchema>;
export type Decision = {
  decision: 'ALLOW' | 'DENY' | 'UNAVAILABLE'; reasonCode: string; serviceId: ServiceId;
  grantKey: string; checkedBlock?: string; checkedAt: string; observedCreator?: string; requestId: string;
};
export function parseResource(resource: string) {
  resourceSchema.parse(resource);
  const segments = resource.split('/');
  return { runId: segments[3]!, project: projectSchema.parse(segments[4]) };
}
