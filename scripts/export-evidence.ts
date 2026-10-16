import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
// Allowlist only public observations; never export .env, cookies, raw signed
// transactions, challenge nonces, headers or request signatures.
const probe=JSON.parse(await readFile('.local/arkiv-probe.json','utf8')) as {runId:string;observations:Record<string,unknown>[]};
const live=JSON.parse(await readFile('.local/live-results.json','utf8')) as Record<string,unknown>[];
const permitted=['id','resource','operation','status','txHash','entityKey','block','errorCode','query','creator','owner','flags','expiresAt','payload','deletedAbsent','forgedCreator','expectedOwner','expiryPresent','runId','mode','project','results','before','after'];
function sanitize(value:unknown):unknown {
  if(Array.isArray(value))return value.map(sanitize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>permitted.includes(key)||[
    'schemaVersion','chainId','deploymentId','agent','permissions','service','action','notAfterUnix','delegation','readonly','permissionlessExtension','raw',
    'decision','reasonCode','serviceId','grantKey','checkedBlock','checkedAt','observedCreator','requestId','httpStatus','title','body','revision','content','preview',
  ].includes(key)).map(([key,item])=>[key,sanitize(item)]));
  return value;
}
let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
await mkdir('docs',{recursive:true});
await writeFile('docs/evidence.json',JSON.stringify({network:'Tiramisu',chainId:7738577,commit,exportedAt:new Date().toISOString(),lifecycle:sanitize(probe.observations),live:sanitize(live)},null,2));
const grants=live.filter(row=>row.operation==='grant');
if(grants.length>=2)await writeFile('.local/independent-manifest.json',JSON.stringify({grants:grants.map(row=>({grantKey:row.entityKey,resource:row.resource,expected:String(row.resource).endsWith('/atlas')?'DENY':'ALLOW'}))},null,2));
console.log('Public evidence exported to docs/evidence.json; fresh independent manifest is local.');
