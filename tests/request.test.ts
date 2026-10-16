import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem';
import { Entity, jsonToPayload } from '@arkiv-network/sdk';
import { str, addr, i32 } from '@arkiv-network/sdk/attr';
import { signRequest } from '../packages/core/src/signing.js';
import type { Envelope } from '../packages/core/src/contracts.js';

const mocked=vi.hoisted(()=>({agent:'',rpcFailure:false,stale:false,regress:false,entity:null as Entity|null,reads:0}));
vi.mock('../packages/core/src/db.js',()=>({database:()=>async()=>[{now_unix:Date.now()/1000,now_ms:Date.now()}]}));
vi.mock('../packages/core/src/runtime.js',()=>({
  challengeExists:async(envelope:Envelope,agent:string)=>agent.toLowerCase()===mocked.agent.toLowerCase()&&envelope.requestExpiresAtUnix>Date.now()/1000,
  observeHead:async()=>!mocked.regress,
}));
vi.mock('../packages/core/src/arkiv.js',()=>({
  arkivClient:()=>({getChainId:async()=>{if(mocked.rpcFailure)throw new Error('RPC');return 7738577;},getBlock:async()=>({number:100n,hash:'0xabc',timestamp:BigInt(Math.floor(Date.now()/1000)-(mocked.stale?30:0))})}),
  grantQuery:()=>({fetch:async()=>{mocked.reads++;return {blockNumber:100n,entities:mocked.entity?[mocked.entity]:[]};}}),
}));
import { verifyToolRequest } from '../packages/core/src/verifier.js';

const owner='0x1111111111111111111111111111111111111111';
const account=privateKeyToAccount(generatePrivateKey());
const runId=randomUUID();const resource=`demo://bound/${runId}/atlas`;
const raw=Buffer.from(JSON.stringify({resource,action:'preview.update',title:'Title',body:'Updated body.'}));
function envelope():Envelope{return {serviceId:'bound.preview.v1',resource,action:'preview.update',grantKey:`0x${'11'.repeat(32)}`,bodyHash:keccak256(raw),nonce:`0x${'22'.repeat(32)}`,requestExpiresAtUnix:Math.floor(Date.now()/1000)+25};}
async function verify(change:Partial<Parameters<typeof verifyToolRequest>[0]>={}) {
  const env=envelope();const signature=await signRequest(account,'test',env);
  return verifyToolRequest({raw,envelope:env,signature,serviceId:'bound.preview.v1',deploymentId:'test',owner,...change});
}
describe('signed requests and unavailable dependencies: T05/T13/T16',()=>{
  beforeEach(()=>{
    mocked.agent=account.address;mocked.rpcFailure=false;mocked.stale=false;mocked.regress=false;mocked.reads=0;
    mocked.entity=new Entity({creator:owner,owner,expiresAt:200n,contentType:'application/json',creationFlags:{readonly:true,permissionlessExtension:false,raw:1},
      payload:jsonToPayload({schemaVersion:1,chainId:7738577,deploymentId:'test',resource,agent:account.address,notAfterUnix:Math.floor(Date.now()/1000)+900,delegation:false,permissions:[{service:'bound.preview.v1',action:'preview.update'}]}),
      attributes:{app:str('bound_v1'),kind:str('grant'),run_id:str(runId),resource:str(resource),agent:addr(account.address),version:i32(1)}});
  });
  it('verifies a real EIP-712 EOA signature',async()=>{expect((await verify()).result.decision).toBe('ALLOW');});
  it('binds the exact body bytes, including whitespace',async()=>{const result=await verify({raw:Buffer.concat([raw,Buffer.from(' ')])});expect(result.result.reasonCode).toBe('BODY_TAMPERED');expect(mocked.reads).toBe(0);});
  it('rejects a signature from a different deployment',async()=>{expect((await verify({deploymentId:'elsewhere'})).result.decision).toBe('DENY');expect(mocked.reads).toBe(0);});
  it('rejects a different service before querying Arkiv',async()=>{expect((await verify({serviceId:'bound.content.v1'})).result.decision).toBe('DENY');expect(mocked.reads).toBe(0);});
  it('does not authorize on RPC error',async()=>{mocked.rpcFailure=true;expect((await verify()).result.decision).toBe('UNAVAILABLE');});
  it('does not authorize on stale state',async()=>{mocked.stale=true;expect((await verify()).result.reasonCode).toBe('STALE_STATE');});
  it('does not authorize on a block regression observed by another instance',async()=>{mocked.regress=true;expect((await verify()).result.reasonCode).toBe('STATE_REGRESSION');});
  it('re-reads an exact grant rather than caching a prior ALLOW',async()=>{expect((await verify()).result.decision).toBe('ALLOW');mocked.entity=null;expect((await verify()).result.reasonCode).toBe('GRANT_NOT_ACTIVE');expect(mocked.reads).toBe(2);});
});
