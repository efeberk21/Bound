import { privateKeyToAccount } from 'viem/accounts';
import { formatEther } from 'viem';
import { arkivClient } from '../packages/core/src/arkiv.js';
const client = arkivClient();
try {
  const head = await client.getBlock({blockTag:'latest'});
  console.log(JSON.stringify({chainId:await client.getChainId(),head:head.number?.toString(),timestamp:Number(head.timestamp),ageSeconds:Date.now()/1000-Number(head.timestamp)}));
  for (const name of ['DEMO_OWNER_PRIVATE_KEY','ATTACKER_PRIVATE_KEY']) {
    const account = privateKeyToAccount(process.env[name] as `0x${string}`);
    console.log(JSON.stringify({role:name.replace('_PRIVATE_KEY',''),address:account.address,testGlm:formatEther(await client.getBalance({address:account.address}))}));
  }
} catch { console.error('Tiramisu check unavailable; RPC credentials and keys are not logged.');process.exitCode=1; }
