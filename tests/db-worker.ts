import { consumeAndApply } from '../packages/core/src/runtime.js';
import type { VerifiedOperation } from '../packages/core/src/runtime.js';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const parsed = JSON.parse(input) as VerifiedOperation & { checkedBlock: string };
  const result = await consumeAndApply({ ...parsed, checkedBlock: BigInt(parsed.checkedBlock) }, {title:'Updated',body:'A verified update.'});
  process.stdout.write(JSON.stringify({applied: result !== null}));
} catch {
  process.stdout.write(JSON.stringify({error:'DATABASE_UNAVAILABLE'}));
  process.exitCode = 1;
}
