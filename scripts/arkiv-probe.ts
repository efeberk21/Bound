import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { arkivClient, grantQuery } from '../packages/core/src/arkiv.js';
import { database } from '../packages/core/src/db.js';
import { requestChainOperation, resumeChainOperation, publicOperation, type ChainState } from '../packages/core/src/chain.js';
if(existsSync('.env'))process.loadEnvFile('.env');
const sql=database();
const runId=randomUUID();
const deploymentId=process.env.DEPLOYMENT_ID!;
const agent=privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex).address;
const resource=`demo://bound/${runId}/atlas`;
const observations:unknown[]=[];
async function confirmed(row:ChainState) {
  for(let attempt=0;attempt<20&& !['confirmed','failed'].includes(row.status);attempt++) {
    await new Promise(resolve=>setTimeout(resolve,2000)); row=await resumeChainOperation(row);
  }
  observations.push(publicOperation(row));
  console.log(JSON.stringify(publicOperation(row)));
  if(row.status!=='confirmed')throw new Error('CHAIN_CONFIRMATION_INCOMPLETE');
  return row;
}
try {
  await sql`INSERT INTO sessions(run_id,deployment_id,expires_at) VALUES (${runId}::uuid,${deploymentId},clock_timestamp()+interval '5 minutes')`;
  const grant=await confirmed(await requestChainOperation({resource,operation:'grant',agent,deploymentId}));
  const client=arkivClient();
  const head=await client.getBlock({blockTag:'latest'});
  const query=grantQuery(client,grant.entity_key as Hex,head.number!);
  const page=await query.fetch(); const entity=page.entities[0];
  if(!entity)throw new Error('GRANT_READ_FAILED');
  const read={query:query.toString(),block:page.blockNumber.toString(),creator:entity.creator,owner:entity.owner,
    flags:entity.creationFlags,expiresAt:entity.expiresAt?.toString(),payload:entity.toJson()};
  observations.push(read);console.log(JSON.stringify(read));
  const deleted=await confirmed(await requestChainOperation({resource,operation:'revoke',agent,deploymentId,entityKey:grant.entity_key as Hex}));
  const after=await client.getBlock({blockTag:'latest'});
  const deletedPage=await grantQuery(client,grant.entity_key as Hex,after.number!).fetch();
  observations.push({deletedAbsent:deletedPage.entities.length===0,block:after.number!.toString(),txHash:deleted.transaction_hash});
  if(deletedPage.entities.length)throw new Error('DELETE_NOT_VISIBLE');
  const forged=await confirmed(await requestChainOperation({resource,operation:'forged',agent,deploymentId}));
  const forgedHead=await client.getBlock({blockTag:'latest'});
  const forgedPage=await grantQuery(client,forged.entity_key as Hex,forgedHead.number!).fetch();
  observations.push({forgedCreator:forgedPage.entities[0]?.creator,expectedOwner:process.env.DEMO_OWNER_ADDRESS});
  const expiry=await confirmed(await requestChainOperation({resource,operation:'expiry',agent,deploymentId}));
  let expired=false;
  for(let attempt=0;attempt<40;attempt++) {
    const block=await client.getBlock({blockTag:'latest'});
    const result=await grantQuery(client,expiry.entity_key as Hex,block.number!).fetch();
    observations.push({expiryPresent:result.entities.length>0,block:block.number!.toString()});
    if(!result.entities.length){expired=true;break;}
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(!expired)throw new Error('EXPIRY_NOT_OBSERVED');
  console.log('Arkiv lifecycle probe passed.');
} catch {console.error('Arkiv lifecycle probe incomplete; see sanitized observations.');process.exitCode=1;}
finally {await writeFile('.local/arkiv-probe.json',JSON.stringify({runId,observations},null,2));}
