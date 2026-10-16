import { appendFile, readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Fresh synthetic test identities. Never import a real wallet or print a key.
let source = await readFile('.env', 'utf8').catch(() => '');
const values = new Map(source.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const index = line.indexOf('='); return [line.slice(0,index),line.slice(index+1)];
}));
function ensure(name: string, value: () => string) {
  if (values.get(name)) return;
  const next = value(); values.set(name,next); source += `${name}=${next}\n`;
}
const originalLength = (await readFile('.env','utf8').catch(()=>'')).length;
ensure('DEMO_OWNER_PRIVATE_KEY',generatePrivateKey);
ensure('ATTACKER_PRIVATE_KEY',generatePrivateKey);
ensure('AGENT_PRIVATE_KEY',generatePrivateKey);
ensure('DEMO_OWNER_ADDRESS',()=>privateKeyToAccount(values.get('DEMO_OWNER_PRIVATE_KEY') as `0x${string}`).address);
ensure('AGENT_ADDRESS',()=>privateKeyToAccount(values.get('AGENT_PRIVATE_KEY') as `0x${string}`).address);
ensure('DEPLOYMENT_ID',()=>randomUUID());
ensure('DEMO_SESSION_SECRET',()=>randomBytes(32).toString('hex'));
ensure('ARKIV_RPC_URL',()=>'https://rpc.tiramisu.db-chain.testnet.arkiv.network');
ensure('PUBLIC_ORIGIN',()=>'http://localhost:5174');
if(values.get('DATABASE_URL'))ensure('DATABASE_URL_UNPOOLED',()=>{
  const direct=new URL(values.get('DATABASE_URL')!);
  direct.hostname=direct.hostname.replace('-pooler.','.');
  return direct.toString();
});
await appendFile('.env',source.slice(originalLength));
for (const [role,key] of [['demo owner','DEMO_OWNER_PRIVATE_KEY'],['attacker','ATTACKER_PRIVATE_KEY'],['agent','AGENT_PRIVATE_KEY']] as const) {
  console.log(`${role}: ${privateKeyToAccount(values.get(key) as `0x${string}`).address}`);
}
console.log('Test-only keys remain in git-excluded .env. Owner and attacker need faucet GLM; agent does not.');
