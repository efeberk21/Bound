import { z } from 'zod';
import type { Hex } from 'viem';
import { addressSchema, resourceSchema, parseResource, type ServiceId } from './contracts.js';
import { configuration } from './config.js';
import { operation, rawBody, safeHandler, send } from './http.js';
import { issueChallenge, consumeAndApply } from './runtime.js';
import { verifyToolRequest } from './verifier.js';
import atlas from '../../../fixtures/atlas.json' with {type:'json'};
import boreal from '../../../fixtures/boreal.json' with {type:'json'};

export function toolHandler(serviceId:ServiceId) {
  return safeHandler(async(request,response)=>{
    const op=operation(request);
    if(request.method==='GET'&&op==='health') {send(response,200,{serviceId,status:'ok'});return;}
    if(request.method!=='POST'){send(response,405,{error:'METHOD_NOT_ALLOWED'});return;}
    let raw:Buffer;
    try {raw=await rawBody(request);}catch {send(response,400,{decision:'DENY',reasonCode:'INVALID_PAYLOAD'});return;}
    const config=configuration();
    if(op==='challenge') {
      const schema=z.object({resource:resourceSchema,agent:addressSchema}).strict();
      let body:z.infer<typeof schema>;
      try {body=schema.parse(JSON.parse(raw.toString('utf8')));}catch {send(response,400,{decision:'DENY',reasonCode:'INVALID_PAYLOAD'});return;}
      try {send(response,200,await issueChallenge({...body,serviceId,deploymentId:config.deploymentId}));}
      catch {send(response,503,{decision:'UNAVAILABLE',reasonCode:'CHALLENGE_UNAVAILABLE'});}
      return;
    }
    if(op!=='execute'){send(response,404,{error:'NOT_FOUND'});return;}
    const encoded=request.headers['x-bound-request'];const signature=request.headers['x-bound-signature'];
    let envelope:unknown;
    if(typeof encoded!=='string'||encoded.length>4096||typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      send(response,403,{decision:'DENY',reasonCode:'BAD_SIGNATURE'});return;
    }
    try {envelope=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}
    catch {send(response,400,{decision:'DENY',reasonCode:'INVALID_PAYLOAD'});return;}
    const rpcUrl=(serviceId==='bound.content.v1'?process.env.CONTENT_ARKIV_RPC_URL:process.env.PREVIEW_ARKIV_RPC_URL)||process.env.ARKIV_RPC_URL;
    const verification=await verifyToolRequest({raw,envelope,signature:signature as Hex,serviceId,deploymentId:config.deploymentId,owner:config.owner,...(rpcUrl?{rpcUrl}:{})});
    if(!verification.verified||!verification.body) {
      send(response,verification.result.decision==='UNAVAILABLE'?503:403,verification.result);return;
    }
    const preview='title'in verification.body?{title:verification.body.title,body:verification.body.body}:undefined;
    const applied=await consumeAndApply(verification.verified,preview);
    if(!applied){send(response,403,{...verification.result,decision:'DENY',reasonCode:'NONCE_OR_TIME_INVALID'});return;}
    if(preview)send(response,200,{...verification.result,preview:applied});
    else {
      const {project}=parseResource(verification.verified.envelope.resource);
      const fixture=project==='atlas'?atlas:boreal;
      send(response,200,{...verification.result,content:{title:fixture.title,body:fixture.body}});
    }
  });
}
