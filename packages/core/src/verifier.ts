import { randomUUID } from 'node:crypto';
import { keccak256, recoverTypedDataAddress, type Hex } from 'viem';
import { arkivClient, grantQuery } from './arkiv.js';
import { CHAIN_ID, contentBodySchema, envelopeSchema, previewBodySchema, type Decision, type Envelope, type ServiceId } from './contracts.js';
import { typedRequest } from './signing.js';
import { evaluateGrant } from './policy.js';
import { challengeExists, observeHead, type VerifiedOperation } from './runtime.js';
import { database } from './db.js';

export type Verification = {result:Decision;verified?:VerifiedOperation;body?:ReturnType<typeof previewBodySchema.parse>|ReturnType<typeof contentBodySchema.parse>};

export async function verifyToolRequest(input: {raw:Buffer;envelope:unknown;signature:Hex;serviceId:ServiceId;deploymentId:string;owner:string;rpcUrl?:string}): Promise<Verification> {
  const base: Decision = {decision:'DENY',reasonCode:'INVALID_PAYLOAD',serviceId:input.serviceId,grantKey:'',checkedAt:new Date().toISOString(),requestId:randomUUID()};
  const reject = (reasonCode: string, unavailable=false): Verification => ({result:{...base,decision:unavailable?'UNAVAILABLE':'DENY',reasonCode}});
  const parsed = envelopeSchema.safeParse(input.envelope);
  if (!parsed.success || input.raw.length > 8192) return reject('INVALID_PAYLOAD');
  const envelope: Envelope = parsed.data;
  base.grantKey = envelope.grantKey;
  let body: Verification['body'];
  try {body = (input.serviceId === 'bound.content.v1' ? contentBodySchema : previewBodySchema).parse(JSON.parse(input.raw.toString('utf8')));}
  catch {return reject('INVALID_PAYLOAD');}
  const expectedAction = input.serviceId === 'bound.content.v1' ? 'content.read' : 'preview.update';
  if (envelope.serviceId !== input.serviceId || envelope.action !== expectedAction || body.action !== expectedAction || envelope.resource !== body.resource) return reject('WRONG_SCOPE');
  if (keccak256(input.raw) !== envelope.bodyHash) return reject('BODY_TAMPERED');
  let agent: Hex;
  try { agent = await recoverTypedDataAddress({...typedRequest(input.deploymentId,envelope),signature:input.signature}); }
  catch {return reject('BAD_SIGNATURE');}
  try {
    if (!await challengeExists(envelope,agent,input.deploymentId)) return reject('NONCE_INVALID');
    const client = arkivClient(input.rpcUrl);
    if (await client.getChainId() !== CHAIN_ID) return reject('WRONG_CHAIN',true);
    let head = await client.getBlock({blockTag:'latest'});
    // At most one retry when the head advances during the pinned read.
    for (let attempt=0;attempt<2;attempt++) {
      if (head.number === null) return reject('MISSING_CHAIN_FIELDS',true);
      const sql = database();
      const clock = await sql`SELECT extract(epoch FROM clock_timestamp()) AS now_unix`;
      const nowUnix = Number(clock[0]!.now_unix);
      const age = nowUnix - Number(head.timestamp);
      if (age > 15 || age < -5) return reject('STALE_STATE',true);
      if (!await observeHead(input.deploymentId,input.serviceId,head.number)) return reject('STATE_REGRESSION',true);
      const query = grantQuery(client,envelope.grantKey as Hex,head.number);
      const page = await query.fetch();
      if (page.blockNumber !== head.number) return reject('SNAPSHOT_MISMATCH',true);
      const entity = page.entities[0] ?? null;
      base.checkedBlock = head.number.toString();
      if (entity?.creator) base.observedCreator = entity.creator;
      const policy = evaluateGrant(entity,{envelope,agent,owner:input.owner,deploymentId:input.deploymentId,block:head.number,nowUnix});
      console.info(JSON.stringify({serviceId:input.serviceId,query:query.toString(),checkedBlock:head.number.toString(),
        decision:policy.ok?'ALLOW':policy.unavailable?'UNAVAILABLE':'DENY',reasonCode:policy.ok?'GRANT_VALID':policy.reasonCode,requestId:base.requestId}));
      const after = await client.getBlock({blockTag:'latest'});
      if (after.number !== head.number || after.hash !== head.hash) {
        if (attempt===0) {head=after; continue;}
        return reject('UNSTABLE_HEAD',true);
      }
      if (!policy.ok) return reject(policy.reasonCode,policy.unavailable);
      // Bind freshness to database time so distinct function machines use one clock.
      const verifiedClock = await sql`SELECT extract(epoch FROM clock_timestamp()) * 1000 AS now_ms`;
      const checkedAtMs = Number(verifiedClock[0]!.now_ms);
      const finalAge = checkedAtMs/1000-Number(after.timestamp);
      if (finalAge>15 || finalAge < -5) return reject('STALE_STATE',true);
      base.checkedAt = new Date(checkedAtMs).toISOString();
      return {result:{...base,decision:'ALLOW',reasonCode:'GRANT_VALID'},body,
        verified:{envelope,agent,deploymentId:input.deploymentId,checkedBlock:head.number,checkedAtMs,notAfterUnix:policy.grant.notAfterUnix}};
    }
    return reject('UNSTABLE_HEAD',true);
  } catch { return reject('DEPENDENCY_UNAVAILABLE',true); }
}
