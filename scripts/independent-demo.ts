import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { verifyIndependent } from './verify.js';
import { keySchema, resourceSchema } from '../packages/core/src/contracts.js';
import { signedCall } from '../packages/core/src/runner.js';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
const {values}=parseArgs({options:{manifest:{type:'string'},tools:{type:'string'}}});
try {
  const manifest=z.object({grants:z.array(z.object({grantKey:keySchema,resource:resourceSchema,expected:z.enum(['ALLOW','DENY'])}).strict()).min(2)}).strict()
    .parse(JSON.parse(await readFile(values.manifest??'','utf8')));
  for(const grant of manifest.grants){
    const result=await verifyIndependent(grant.grantKey,grant.resource);
    console.log(JSON.stringify(result));if(result.decision!==grant.expected)process.exitCode=1;
    if(values.tools){
      const origin=z.url().parse(values.tools);
      const account=privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
      for(const service of ['content','preview'] as const){
        const request=await signedCall({account,deploymentId:process.env.DEPLOYMENT_ID!,url:`${origin}/api/${service}`,serviceId:`bound.${service}.v1`,
          resource:grant.resource,grantKey:grant.grantKey as Hex,...(service==='preview'?{preview:{title:'Independent CLI preview',body:'Fresh signed request while management endpoints are unavailable.'}}:{})});
        const reply=await request.call();console.log(JSON.stringify(reply));if(reply.decision!==grant.expected)process.exitCode=1;
      }
    }
  }
}catch{console.error('Independent verification incomplete. No control or web endpoint was consulted.');process.exitCode=1;}
