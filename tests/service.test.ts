import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { sealData } from 'iron-session';
import { toolHandler } from '../packages/core/src/tools.js';
import control from '../api/control.js';
import run from '../api/run.js';
import type { Handler } from '../packages/core/src/http.js';

const state=vi.hoisted(()=>({decision:'DENY',databaseFails:false,revision:0,runId:'',mutations:0}));
vi.mock('../packages/core/src/verifier.js',()=>({verifyToolRequest:async()=>({
  result:{decision:state.decision,reasonCode:state.decision==='ALLOW'?'GRANT_VALID':state.decision==='UNAVAILABLE'?'RPC_UNAVAILABLE':'WRONG_SCOPE',serviceId:'bound.preview.v1',grantKey:'public-test-key',checkedAt:new Date().toISOString(),requestId:'test'},
  ...(state.decision==='ALLOW'?{verified:{},body:{title:'After',body:'New preview'}}:{}),
})}));
vi.mock('../packages/core/src/runtime.js',()=>({
  consumeAndApply:async()=>{if(state.databaseFails)throw new Error('DB outage');state.revision++;state.mutations++;return {revision:state.revision};},
  issueChallenge:async()=>{throw new Error('DB outage');},startSession:async()=>null,
}));
vi.mock('../packages/core/src/db.js',()=>({database:()=>async()=>[{run_id:state.runId,expires_at:new Date(Date.now()+60000).toISOString(),model_calls:0}]}));

let server:Server;let origin='';
const secret='test-session-secret-not-a-real-credential-123456';
const previous={...process.env};
async function post(path:string,body:unknown,cookie=''){
  return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie,
    'x-bound-request':Buffer.from('{}').toString('base64url'),'x-bound-signature':`0x${'11'.repeat(65)}`},body:JSON.stringify(body)});
}
describe('HTTP failure boundary and real session sealing: T13/T19',()=>{
  beforeAll(async()=>{
    state.runId=randomUUID();
    process.env.DEPLOYMENT_ID='http-tests';process.env.DEMO_OWNER_ADDRESS='0x1111111111111111111111111111111111111111';process.env.DEMO_SESSION_SECRET=secret;
    const routes:Record<string,Handler>={preview:toolHandler('bound.preview.v1'),control,run};
    server=createServer((request,response)=>{const key=(request.url??'').split('/')[2]!;void routes[key]!(request,response);});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();if(!address||typeof address==='string')throw new Error('No test server');
    origin=`http://127.0.0.1:${address.port}`;process.env.PUBLIC_ORIGIN=origin;
  });
  afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));process.env=previous;});
  beforeEach(()=>{state.decision='DENY';state.databaseFails=false;state.revision=5;state.mutations=0;});
  it.each(['DENY','UNAVAILABLE'])('does not enter the preview mutation on %s',async decision=>{
    state.decision=decision;const response=await post('/api/preview/execute',{});
    expect(response.status).toBe(decision==='DENY'?403:503);expect(state.revision).toBe(5);expect(state.mutations).toBe(0);
  });
  it('Neon failure after verification performs no memory fallback or update',async()=>{
    state.decision='ALLOW';state.databaseFails=true;
    expect((await post('/api/preview/execute',{})).status).toBe(503);expect(state.revision).toBe(5);expect(state.mutations).toBe(0);
  });
  it('rejects an invalid session cookie on management and runner routes',async()=>{
    expect((await post('/api/control/grant',{project:'atlas'},'bound_demo=forged')).status).toBe(403);
    expect((await post('/api/run',{project:'atlas',mode:'deterministic'},'bound_demo=forged')).status).toBe(403);
  });
  it('cannot select another session by injecting run_id into an authenticated request',async()=>{
    const seal=await sealData({runId:state.runId,deploymentId:'http-tests'},{password:secret,ttl:300});
    const cookie=`bound_demo=${seal}`;
    expect((await post('/api/control/grant',{project:'atlas',run_id:randomUUID()},cookie)).status).toBe(400);
    expect((await post('/api/run',{project:'atlas',mode:'deterministic',run_id:randomUUID()},cookie)).status).toBe(400);
    expect(state.mutations).toBe(0);
  });
});
