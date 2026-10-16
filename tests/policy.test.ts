import { describe, expect, it } from 'vitest';
import { Entity, jsonToPayload } from '@arkiv-network/sdk';
import { addr, i32, str } from '@arkiv-network/sdk/attr';
import { randomUUID } from 'node:crypto';
import { evaluateGrant } from '../packages/core/src/policy.js';
import type { Envelope, Grant } from '../packages/core/src/contracts.js';

const owner='0x1111111111111111111111111111111111111111';
const agent='0x2222222222222222222222222222222222222222';
const other='0x3333333333333333333333333333333333333333';
const runId=randomUUID();const resource=`demo://bound/${runId}/atlas`;
const grant:Grant={schemaVersion:1,chainId:7738577,deploymentId:'test',resource,agent,permissions:[{service:'bound.content.v1',action:'content.read'},{service:'bound.preview.v1',action:'preview.update'}],notAfterUnix:2000,delegation:false};
const envelope:Envelope={resource,serviceId:'bound.preview.v1',action:'preview.update',grantKey:`0x${'11'.repeat(32)}`,bodyHash:`0x${'22'.repeat(32)}`,nonce:`0x${'33'.repeat(32)}`,requestExpiresAtUnix:1020};
const context={envelope,agent,owner,deploymentId:'test',block:100n,nowUnix:1000};
function entity(payload:object=grant){return new Entity({key:envelope.grantKey as `0x${string}`,owner,creator:owner,expiresAt:200n,creationFlags:{readonly:true,permissionlessExtension:false,raw:1},payload:jsonToPayload(payload),contentType:'application/json',attributes:{app:str('bound_v1'),kind:str('grant'),run_id:str(runId),resource:str(resource),agent:addr(agent),version:i32(1)}});}

describe('grant policy: T02/T03/T04/T12/T14/T17',()=>{
  it('accepts the precise authorized operation',()=>{expect(evaluateGrant(entity(),context).ok).toBe(true);});
  it.each([
    ['forged creator','UNTRUSTED_CREATOR',(e:Entity)=>{e.creator=other;}],
    ['transferred owner','OWNER_CHANGED',(e:Entity)=>{e.owner=other;}],
    ['mutable scope','UNSAFE_FLAGS',(e:Entity)=>{e.creationFlags={readonly:false,permissionlessExtension:false,raw:0};}],
    ['permissionless extension','UNSAFE_FLAGS',(e:Entity)=>{e.creationFlags={readonly:true,permissionlessExtension:true,raw:3};}],
    ['reserved flag','UNSAFE_FLAGS',(e:Entity)=>{e.creationFlags={readonly:true,permissionlessExtension:false,raw:5};}],
    ['expired on chain','GRANT_NOT_ACTIVE',(e:Entity)=>{e.expiresAt=100n;}],
    ['attribute conflict','INVALID_PAYLOAD',(e:Entity)=>{e.attributes={...e.attributes,resource:str(`demo://bound/${runId}/boreal`)};}],
    ['wrong attribute type','INVALID_PAYLOAD',(e:Entity)=>{e.attributes={...e.attributes,version:str('1')};}],
  ] as const)('rejects %s',(_label,reason,change)=>{const e=entity();change(e);expect(evaluateGrant(e,context)).toMatchObject({ok:false,reasonCode:reason});});
  it.each([
    {schemaVersion:2},{chainId:1},{delegation:true},{extra:'unsupported'},
    {permissions:[{service:'bound.preview.v1',action:'shell.execute'}]},
  ])('rejects unsupported payload %j',change=>{expect(evaluateGrant(entity({...grant,...change}),context)).toMatchObject({ok:false,reasonCode:'INVALID_PAYLOAD'});});
  it('rejects a different agent',()=>{expect(evaluateGrant(entity(),{...context,agent:other})).toMatchObject({ok:false,reasonCode:'WRONG_AGENT'});});
  it('rejects another resource',()=>{expect(evaluateGrant(entity(),{...context,envelope:{...envelope,resource:`demo://bound/${runId}/boreal`}})).toMatchObject({ok:false,reasonCode:'WRONG_SCOPE'});});
  it('retains the policy ceiling when the chain expiry is extended',()=>{const e=entity();e.expiresAt=10000n;expect(evaluateGrant(e,{...context,nowUnix:2001})).toMatchObject({ok:false,reasonCode:'POLICY_EXPIRED'});});
  it('distinguishes missing fields from a known inactive grant',()=>{const e=entity();e.creator=undefined;expect(evaluateGrant(e,context)).toMatchObject({ok:false,unavailable:true});expect(evaluateGrant(null,context)).toMatchObject({ok:false,reasonCode:'GRANT_NOT_ACTIVE'});});
  it('rejects invalid UTF-8 instead of accepting replacement characters',()=>{const e=entity();e.payload=new Uint8Array([255]);expect(evaluateGrant(e,context)).toMatchObject({ok:false,reasonCode:'INVALID_PAYLOAD'});});
});

