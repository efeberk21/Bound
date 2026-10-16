import type { EntityFields } from '@arkiv-network/sdk';
import { grantSchema, parseResource, type Envelope, type Grant } from './contracts.js';

export type PolicyResult = {ok:true;grant:Grant} | {ok:false;reasonCode:string;unavailable?:boolean};
export function evaluateGrant(entity: EntityFields | null, context: {
  envelope: Envelope; agent: string; owner: string; deploymentId: string; block: bigint; nowUnix: number;
}): PolicyResult {
  if (!entity) return {ok:false,reasonCode:'GRANT_NOT_ACTIVE'};
  const {envelope,agent,owner,deploymentId,block,nowUnix} = context;
  if (!entity.creator || !entity.owner || !entity.creationFlags || entity.expiresAt === undefined || !entity.attributes || !entity.payload) {
    return {ok:false,reasonCode:'MISSING_CHAIN_FIELDS',unavailable:true};
  }
  if (entity.creator.toLowerCase() !== owner.toLowerCase()) return {ok:false,reasonCode:'UNTRUSTED_CREATOR'};
  if (entity.owner.toLowerCase() !== owner.toLowerCase()) return {ok:false,reasonCode:'OWNER_CHANGED'};
  if (!entity.creationFlags.readonly || entity.creationFlags.permissionlessExtension || entity.creationFlags.raw !== 1) return {ok:false,reasonCode:'UNSAFE_FLAGS'};
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(entity.payload)); }
  catch { return {ok:false,reasonCode:'INVALID_PAYLOAD'}; }
  const parsed = grantSchema.safeParse(payload);
  if (!parsed.success || entity.contentType !== 'application/json') return {ok:false,reasonCode:'INVALID_PAYLOAD'};
  const grant = parsed.data;
  if (grant.deploymentId !== deploymentId) return {ok:false,reasonCode:'WRONG_DEPLOYMENT'};
  const {runId} = parseResource(grant.resource);
  const expected: Record<string,{type:string;value:string|number}> = {
    app:{type:'str',value:'bound_v1'},kind:{type:'str',value:'grant'},run_id:{type:'str',value:runId},
    resource:{type:'str',value:grant.resource},agent:{type:'addr',value:grant.agent.toLowerCase()},version:{type:'i32',value:1},
  };
  for (const [name,expectedValue] of Object.entries(expected)) {
    const actual = entity.attributes[name];
    if (!actual || actual.type !== expectedValue.type || String(actual.value).toLowerCase() !== String(expectedValue.value).toLowerCase()) {
      return {ok:false,reasonCode:'INVALID_PAYLOAD'};
    }
  }
  if (grant.agent.toLowerCase() !== agent.toLowerCase()) return {ok:false,reasonCode:'WRONG_AGENT'};
  if (grant.resource !== envelope.resource || !grant.permissions.some(p=>p.service===envelope.serviceId&&p.action===envelope.action)) {
    return {ok:false,reasonCode:'WRONG_SCOPE'};
  }
  if (entity.expiresAt <= block) return {ok:false,reasonCode:'GRANT_NOT_ACTIVE'};
  if (grant.notAfterUnix <= nowUnix) return {ok:false,reasonCode:'POLICY_EXPIRED'};
  return {ok:true,grant};
}
