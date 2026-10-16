import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { signedCall } from '../packages/core/src/runner.js';
if(existsSync('.env'))process.loadEnvFile('.env');
const origin=process.env.BOUND_TEST_ORIGIN||process.env.PUBLIC_ORIGIN!;
let cookie='';
const records:unknown[]=[];
async function call(path:string,body?:unknown) {
  const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',origin,...(cookie?{cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0]!;
  const result=await response.json() as Record<string,any>;
  if(!response.ok)throw new Error(`${path}: ${response.status} ${String(result.error??result.reasonCode??result.status)}`);
  return result;
}
async function chain(operation:string,project='atlas') {
  let result=await call(`/api/control/${operation}`,{project});
  for(let retry=0;retry<20&&!['confirmed','failed'].includes(result.status);retry++) {
    await new Promise(resolve=>setTimeout(resolve,2000));result=await call('/api/control/status',{id:result.id});
  }
  records.push(result);expect(result.status).toBe('confirmed');return result;
}
function decisions(result:Record<string,any>) {
  records.push(result);
  return result.results.map((row:Record<string,unknown>)=>row.decision);
}
async function worker(){
  const child=spawn(process.execPath,['--import','tsx','tests/http-worker.ts'],{stdio:['ignore','pipe','pipe']});
  const url=await new Promise<string>((resolve,reject)=>{
    let output='';child.stdout.on('data',chunk=>{output+=String(chunk);if(output.includes('\n')){try{resolve(JSON.parse(output.split('\n')[0]!).url);}catch{reject(new Error('Worker startup failed'));}}});
    child.on('error',reject);child.on('exit',()=>reject(new Error('Worker exited')));
  });
  return {url,stop:()=>child.kill()};
}
describe('Live Tiramisu + local HTTP + real Neon',()=>{
  it('T01/T02/T03/T06/T09/T10: legitimate work, attacks and selective revocation',async()=>{
    try {
      const session=await call('/api/control/start',{});records.push({runId:session.runId});
      // T19: a forged session cannot create/execute; body run_id never chooses a session.
      const outsider=await fetch(origin+'/api/control/grant',{method:'POST',headers:{'content-type':'application/json',origin,cookie:'bound_demo=forged'},body:JSON.stringify({project:'atlas'})});
      expect(outsider.status).toBe(403);
      const injected=await fetch(origin+'/api/run',{method:'POST',headers:{'content-type':'application/json',origin,cookie},body:JSON.stringify({project:'atlas',mode:'deterministic',run_id:randomUUID()})});
      expect(injected.status).toBe(400);
      const creates=await Promise.all([call('/api/control/grant',{project:'atlas'}),call('/api/control/grant',{project:'atlas'})]);
      expect(creates[0]!.id).toBe(creates[1]!.id);
      const atlasGrant=await chain('grant','atlas');await chain('grant','boreal');
      const atlas=await call('/api/run',{project:'atlas',mode:'deterministic'});
      expect(decisions(atlas)).toEqual(['ALLOW','ALLOW']);
      expect(atlas.after.revision).toBe(atlas.before.revision+1);
      const account=privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
      const common={account,deploymentId:process.env.DEPLOYMENT_ID!,resource:atlasGrant.resource,grantKey:atlasGrant.entityKey as Hex};
      // T07/T08: two independent real HTTP processes, same EIP-712 request and real Arkiv/Neon.
      const first=await worker();const second=await worker();
      try{
        const before=(await call('/api/control/state')).previews.find((p:any)=>p.project==='atlas');
        const request=await signedCall({...common,url:first.url,serviceId:'bound.preview.v1',preview:{title:'Concurrent test',body:'Only one update is allowed.'}});
        const concurrent=await Promise.all([request.call(first.url),request.call(second.url)]);
        records.push({mode:'two-process-signed-concurrent',results:concurrent});
        expect(concurrent.filter(result=>result.decision==='ALLOW')).toHaveLength(1);
        const after=(await call('/api/control/state')).previews.find((p:any)=>p.project==='atlas');
        expect(after.revision).toBe(before.revision+1);
        first.stop();const restarted=await worker();
        try{expect((await request.call(restarted.url)).decision).toBe('DENY');}finally{restarted.stop();}
      }finally{first.stop();second.stop();}
      const wrong=await call('/api/run',{project:'atlas',mode:'wrong-project'});
      expect(decisions(wrong)).toEqual(['DENY','DENY']);
      expect(wrong.results.every((row:any)=>row.reasonCode==='WRONG_SCOPE')).toBe(true);
      expect(wrong.after).toEqual(wrong.before);
      await chain('forged');
      const forged=await call('/api/run',{project:'atlas',mode:'forged'});
      expect(decisions(forged)).toEqual(['DENY','DENY']);
      expect(forged.results.every((row:any)=>row.reasonCode==='UNTRUSTED_CREATOR')).toBe(true);
      expect(forged.after).toEqual(forged.before);
      const replay=await call('/api/run',{project:'atlas',mode:'replay'});
      expect(decisions(replay)).toEqual(['ALLOW','DENY']);
      expect(replay.after.revision).toBe(replay.before.revision+1);
      // T15: successful read, controlled gap, then real revoke before a new preview request.
      const precedingRead=await(await signedCall({...common,url:origin+'/api/content',serviceId:'bound.content.v1'})).call();
      expect(precedingRead.decision).toBe('ALLOW');
      await chain('revoke');
      const blockedUpdate=await(await signedCall({...common,url:origin+'/api/preview',serviceId:'bound.preview.v1',preview:{title:'Must not appear',body:'Revoked after read.'}})).call();
      expect(blockedUpdate.decision).toBe('DENY');records.push({mode:'controlled-read-revoke-update',results:[precedingRead,blockedUpdate]});
      const revoked=await call('/api/run',{project:'atlas',mode:'check'});
      expect(decisions(revoked)).toEqual(['DENY','DENY']);expect(revoked.after).toEqual(revoked.before);
      const boreal=await call('/api/run',{project:'boreal',mode:'deterministic'});
      expect(decisions(boreal)).toEqual(['ALLOW','ALLOW']);expect(boreal.after.revision).toBe(boreal.before.revision+1);
      await chain('expiry');
      const beforeExpiry=await call('/api/run',{project:'atlas',mode:'expiry'});expect(decisions(beforeExpiry)).toEqual(['ALLOW','ALLOW']);
      await new Promise(resolve=>setTimeout(resolve,65000));
      const afterExpiry=await call('/api/run',{project:'atlas',mode:'expiry'});expect(decisions(afterExpiry)).toEqual(['DENY','DENY']);expect(afterExpiry.after).toEqual(afterExpiry.before);
    } finally {await writeFile('.local/live-results.json',JSON.stringify(records,null,2));}
  },240000);
});
