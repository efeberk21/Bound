import { randomUUID } from 'node:crypto';
import { createWalletClient, ExpirationTime, jsonToPayload, ENTITY_EVENTS_ABI } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { addr, i32, str } from '@arkiv-network/sdk/attr';
import { custom, http, keccak256, parseEventLogs, type Hex, type TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sendRawTransaction } from 'viem/actions';
import { arkivClient, publicRpc } from './arkiv.js';
import { CHAIN_ID, grantSchema, parseResource, type Grant } from './contracts.js';
import { database } from './db.js';

export type ChainOperation = 'grant'|'revoke'|'forged'|'expiry';
export type ChainState = {
  id:string;run_id:string;resource:string;operation:ChainOperation;signer:string;status:string;
  claim_token:string;raw_transaction:string|null;transaction_hash:string|null;entity_key:string|null;
  block_number:string|null;error_code:string|null;
};
export function publicOperation(row:ChainState) {
  return {id:row.id,resource:row.resource,operation:row.operation,status:row.status,
    txHash:row.transaction_hash,entityKey:row.entity_key,block:row.block_number,errorCode:row.error_code};
}

export function grantData(resource:string,agent:Hex,deploymentId:string,nowUnix:number,expiryTest=false) {
  const payload:Grant = grantSchema.parse({schemaVersion:1,chainId:CHAIN_ID,deploymentId,resource,agent,
    permissions:[{service:'bound.content.v1',action:'content.read'},{service:'bound.preview.v1',action:'preview.update'}],
    notAfterUnix:Math.floor(nowUnix)+(expiryTest?300:900),delegation:false});
  return {
    payload:jsonToPayload(payload),contentType:'application/json',
    attributes:{app:str('bound_v1'),kind:str('grant'),run_id:str(parseResource(resource).runId),resource:str(resource),agent:addr(agent),version:i32(1)},
    expires:ExpirationTime.fromSeconds(expiryTest?60:900),flags:{readonly:true,permissionlessExtension:false},
  } as const;
}

async function recordReceipt(row:ChainState,receipt:TransactionReceipt):Promise<ChainState> {
  const sql=database();
  const created=parseEventLogs({abi:ENTITY_EVENTS_ABI,logs:receipt.logs,eventName:'EntityCreated'})
    .filter(event=>event.address.toLowerCase()==='0x4400000000000000000000000000000000000044');
  const entityKey=row.operation==='revoke'?row.entity_key:(created[0]?.args.entityKey??null);
  const status=receipt.status==='success'&&entityKey?'confirmed':'failed';
  const rows=await sql`UPDATE chain_operations SET status=${status},entity_key=${entityKey},block_number=${receipt.blockNumber.toString()}::bigint,
    error_code=${status==='failed'?'CHAIN_REVERTED':null},updated_at=clock_timestamp()
    WHERE id=${row.id}::uuid RETURNING *`;
  return rows[0] as ChainState;
}

export async function resumeChainOperation(row:ChainState):Promise<ChainState> {
  if (!row.raw_transaction||!row.transaction_hash||['confirmed','failed'].includes(row.status)) return row;
  const client=arkivClient();
  const sql=database();
  try {
    const receipt=await client.getTransactionReceipt({hash:row.transaction_hash as Hex});
    return await recordReceipt(row,receipt);
  } catch (error) {
    if ((error as {name?:string}).name!=='TransactionReceiptNotFoundError') return row;
  }
  try {
    // Re-broadcasting the identical bytes is safe after an uncertain network response.
    await sendRawTransaction(client,{serializedTransaction:row.raw_transaction as Hex});
    await sql`UPDATE chain_operations SET status='submitted',updated_at=clock_timestamp() WHERE id=${row.id}::uuid AND status='prepared'`;
    row={...row,status:'submitted'};
  } catch { /* The hash remains the recovery key; never construct a new transaction here. */ }
  return row;
}

export async function requestChainOperation(input:{resource:string;operation:ChainOperation;agent:Hex;deploymentId:string;entityKey?:Hex}) {
  const sql=database();
  const {runId}=parseResource(input.resource);
  const privateKey=process.env[input.operation==='forged'?'ATTACKER_PRIVATE_KEY':'DEMO_OWNER_PRIVATE_KEY'] as Hex;
  const account=privateKeyToAccount(privateKey);
  if (input.operation!=='forged'&&account.address.toLowerCase()!==process.env.DEMO_OWNER_ADDRESS?.toLowerCase()) throw new Error('OWNER_CONFIGURATION_INVALID');
  const claimToken=randomUUID();
  let rows;
  try {
    rows=await sql`
      INSERT INTO chain_operations(id,run_id,resource,operation,signer,status,claim_token,entity_key)
      VALUES (${randomUUID()}::uuid,${runId}::uuid,${input.resource},${input.operation},${account.address.toLowerCase()},'preparing',${claimToken}::uuid,${input.entityKey??null})
      ON CONFLICT (run_id,resource,operation) DO UPDATE SET claim_token=EXCLUDED.claim_token,status='preparing',error_code=NULL,updated_at=clock_timestamp()
      WHERE chain_operations.raw_transaction IS NULL AND (chain_operations.status='failed'
        OR (chain_operations.status='preparing' AND chain_operations.updated_at < clock_timestamp()-interval '30 seconds'))
      RETURNING *
    `;
  } catch {throw new Error('SIGNER_BUSY');}
  if (!rows[0]) {
    const existing=await sql`SELECT * FROM chain_operations WHERE run_id=${runId}::uuid AND resource=${input.resource} AND operation=${input.operation}`;
    if (!existing[0]) throw new Error('SIGNER_BUSY');
    return resumeChainOperation(existing[0] as ChainState);
  }
  const row=rows[0] as ChainState;
  const base=http(process.env.ARKIV_RPC_URL||publicRpc,{timeout:8000,retryCount:0})({chain:tiramisu});
  // The SDK performs ABI encoding, gas/nonce preparation and EOA signing. This
  // transport stops at its documented JSON-RPC send boundary: persist the signed
  // bytes first, then our resumable operation broadcasts them outside the SDK wait.
  const transport=custom({request:async(args:{method:string;params?:unknown})=>{
    if (args.method==='eth_sendRawTransaction') {
      const raw=(args.params as Hex[])[0]!;
      const hash=keccak256(raw);
      const persisted=await sql`UPDATE chain_operations SET raw_transaction=${raw},transaction_hash=${hash},status='prepared',updated_at=clock_timestamp()
        WHERE id=${row.id}::uuid AND claim_token=${claimToken}::uuid AND status='preparing' AND raw_transaction IS NULL RETURNING id`;
      if (!persisted[0]) throw new Error('PREPARATION_CLAIM_LOST');
      throw new Error('BOUND_TRANSACTION_PREPARED');
    }
    return base.request(args as Parameters<typeof base.request>[0]);
  }},{retryCount:0});
  const wallet=createWalletClient({chain:tiramisu,account,transport});
  try {
    if (input.operation==='revoke') {
      if (!input.entityKey) throw new Error('MISSING_ENTITY_KEY');
      await wallet.deleteEntity({entityKey:input.entityKey});
    } else {
      const clock=await sql`SELECT extract(epoch FROM clock_timestamp()) AS now_unix`;
      await wallet.createEntity(grantData(input.resource,input.agent,input.deploymentId,Number(clock[0]!.now_unix),input.operation==='expiry'));
    }
  } catch { /* Expected preparation stop, or a safe failure before anything was sent. */ }
  const prepared=await sql`SELECT * FROM chain_operations WHERE id=${row.id}::uuid`;
  const current=prepared[0] as ChainState;
  if (!current.raw_transaction&&current.claim_token===claimToken) {
    const failed=await sql`UPDATE chain_operations SET status='failed',error_code='PREPARATION_UNAVAILABLE',updated_at=clock_timestamp()
      WHERE id=${row.id}::uuid AND claim_token=${claimToken}::uuid AND raw_transaction IS NULL RETURNING *`;
    return (failed[0]??current) as ChainState;
  }
  return resumeChainOperation(current);
}
