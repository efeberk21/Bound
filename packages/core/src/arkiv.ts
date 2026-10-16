import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { key, str, addr } from '@arkiv-network/sdk/attr';
import { eq } from '@arkiv-network/sdk/query';
import { http, type Hex } from 'viem';

export const publicRpc = 'https://rpc.tiramisu.db-chain.testnet.arkiv.network';
export function arkivClient(rpcUrl = process.env.ARKIV_RPC_URL || publicRpc) {
  return createPublicClient({chain:tiramisu,transport:http(rpcUrl,{timeout:8000,retryCount:0}),cacheTime:0});
}
export function grantQuery(client: ReturnType<typeof arkivClient>, grantKey: Hex, block: bigint) {
  return client.select().where(eq('$key',key(grantKey))).atBlock(block).limit(1);
}
export function listQuery(client: ReturnType<typeof arkivClient>, runId: string, creator: Hex, agent?: Hex, resource?: string) {
  const query = client.select().where(eq('app',str('bound_v1')),eq('kind',str('grant')),eq('run_id',str(runId))).createdBy(creator).limit(100);
  if (agent) query.where(eq('agent',addr(agent)));
  if (resource) query.where(eq('resource',str(resource)));
  return query;
}
