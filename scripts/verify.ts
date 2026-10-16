import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import type { Hex } from 'viem';
import { arkivClient, grantQuery } from '../packages/core/src/arkiv.js';
import { evaluateGrant } from '../packages/core/src/policy.js';
import { addressSchema, keySchema, resourceSchema, type Envelope } from '../packages/core/src/contracts.js';
if(existsSync('.env'))process.loadEnvFile('.env');
export async function verifyIndependent(grantKey:string,resource:string) {
  keySchema.parse(grantKey);resourceSchema.parse(resource);
  const owner=addressSchema.parse(process.env.DEMO_OWNER_ADDRESS);
  const agent=addressSchema.parse(process.env.AGENT_ADDRESS);
  const deploymentId=process.env.DEPLOYMENT_ID;
  if(!deploymentId)throw new Error('DEPLOYMENT_NOT_CONFIGURED');
  const client=arkivClient();
  let head=await client.getBlock({blockTag:'latest'});
  for(let attempt=0;attempt<2;attempt++) {
    if(head.number===null)throw new Error('MISSING_HEAD');
    const age=Date.now()/1000-Number(head.timestamp);if(age>15||age < -5)throw new Error('STALE_STATE');
    const query=grantQuery(client,grantKey as Hex,head.number);
    const page=await query.fetch();
    const after=await client.getBlock({blockTag:'latest'});
    if(after.number!==head.number||after.hash!==head.hash){head=after;continue;}
    const envelope:Envelope={serviceId:'bound.preview.v1',action:'preview.update',resource,grantKey,bodyHash:`0x${'00'.repeat(32)}`,nonce:`0x${'00'.repeat(32)}`,requestExpiresAtUnix:Math.floor(Date.now()/1000)+30};
    const policy=evaluateGrant(page.entities[0]??null,{envelope,owner,agent,deploymentId,block:head.number,nowUnix:Date.now()/1000});
    return {decision:policy.ok?'ALLOW':policy.unavailable?'UNAVAILABLE':'DENY',reasonCode:policy.ok?'GRANT_VALID':policy.reasonCode,
      checkedBlock:head.number.toString(),query:query.toString(),observedCreator:page.entities[0]?.creator,
      grantKey,resource,mode:'Independent grant policy inspection; no HTTP side effect'};
  }
  throw new Error('UNSTABLE_HEAD');
}
if(process.argv[1]?.endsWith('verify.ts')) {
  const {values}=parseArgs({options:{grant:{type:'string'},resource:{type:'string'}}});
  try{console.log(JSON.stringify(await verifyIndependent(values.grant??'',values.resource??''),null,2));}
  catch{console.error(JSON.stringify({decision:'UNAVAILABLE',reasonCode:'INDEPENDENT_VERIFICATION_FAILED'}));process.exitCode=1;}
}
