import { keccak256, stringToHex, type Hex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { CHAIN_ID, type Envelope } from './contracts.js';

export const requestTypes = {
  ToolRequest: [
    {name:'serviceId',type:'string'}, {name:'resource',type:'string'}, {name:'action',type:'string'},
    {name:'grantKey',type:'bytes32'}, {name:'bodyHash',type:'bytes32'}, {name:'nonce',type:'bytes32'},
    {name:'requestExpiresAtUnix',type:'uint256'},
  ],
} as const;
export function typedRequest(deploymentId: string, envelope: Envelope) {
  return {
    domain: {name:'BOUND',version:'1',chainId:CHAIN_ID,salt:keccak256(stringToHex(deploymentId))},
    primaryType: 'ToolRequest' as const, types:requestTypes,
    message:{...envelope,grantKey:envelope.grantKey as Hex,bodyHash:envelope.bodyHash as Hex,
      nonce:envelope.nonce as Hex,requestExpiresAtUnix:BigInt(envelope.requestExpiresAtUnix)},
  };
}
export async function signRequest(account: PrivateKeyAccount, deploymentId: string, envelope: Envelope) {
  return account.signTypedData(typedRequest(deploymentId,envelope));
}
