import { readFile } from 'node:fs/promises';
import { database } from '../packages/core/src/db.js';
try {
  const source = await readFile(new URL('../migrations/001_runtime.sql', import.meta.url), 'utf8');
  const statements = source.split(';').map(sql => sql.trim()).filter(Boolean)
    .filter(sql => sql !== 'BEGIN' && sql !== 'COMMIT');
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (!direct) throw new Error('DATABASE_URL_UNPOOLED_REQUIRED');
  if (new URL(direct).hostname.includes('-pooler.')) throw new Error('DIRECT_MIGRATION_URL_REQUIRED');
  const sql = database(direct);
  await sql.transaction(statements.map(statement => sql.query(statement, [])));
  console.log('BOUND runtime migration applied.');
} catch {
  console.error('Migration failed. Check DATABASE_URL and the dedicated Neon project; credentials are not logged.');
  process.exitCode = 1;
}
