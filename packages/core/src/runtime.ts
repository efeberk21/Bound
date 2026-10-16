import { randomBytes, randomUUID } from 'node:crypto';
import { database } from './db.js';
import { parseResource, type Envelope, type Preview, type ServiceId } from './contracts.js';

export async function issueChallenge(input: { resource: string; agent: string; deploymentId: string; serviceId: ServiceId }) {
  const { runId } = parseResource(input.resource);
  const nonce = `0x${randomBytes(32).toString('hex')}`;
  const sql = database();
  // A shared monotonically increasing counter bounds *all* challenges, including consumed ones.
  const rows = await sql`
    WITH budget AS (
      INSERT INTO runtime_state(key, value)
      SELECT ${`challenges:${input.deploymentId}:${runId}:${input.serviceId}`}, '{"count":1}'::jsonb
      WHERE EXISTS (SELECT 1 FROM sessions WHERE run_id = ${runId}::uuid
        AND deployment_id = ${input.deploymentId} AND expires_at > clock_timestamp())
      ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('count', (runtime_state.value->>'count')::int + 1),
        updated_at = clock_timestamp()
      WHERE (runtime_state.value->>'count')::int < 120
      RETURNING key
    )
    INSERT INTO challenges(nonce, service_id, agent, deployment_id, run_id, expires_at)
    SELECT ${nonce}, ${input.serviceId}, ${input.agent.toLowerCase()}, ${input.deploymentId}, ${runId}::uuid,
      date_trunc('second', clock_timestamp()) + interval '30 seconds' FROM budget
    RETURNING nonce, floor(extract(epoch FROM expires_at))::bigint::text AS expires
  `;
  const row = rows[0];
  if (!row) throw new Error('CHALLENGE_LIMIT');
  return { nonce: String(row.nonce), expiresAtUnix: Number(row.expires) };
}

export async function challengeExists(envelope: Envelope, agent: string, deploymentId: string) {
  const { runId } = parseResource(envelope.resource);
  const sql = database();
  const rows = await sql`
    SELECT nonce FROM challenges WHERE nonce = ${envelope.nonce}
      AND service_id = ${envelope.serviceId} AND agent = ${agent.toLowerCase()}
      AND deployment_id = ${deploymentId} AND run_id = ${runId}::uuid
      AND expires_at > clock_timestamp()
      AND to_timestamp(${envelope.requestExpiresAtUnix}) <= expires_at
      AND to_timestamp(${envelope.requestExpiresAtUnix}) > clock_timestamp()
  `;
  return rows.length === 1;
}

export type VerifiedOperation = {
  envelope: Envelope; agent: string; deploymentId: string; notAfterUnix: number;
  checkedBlock: bigint; checkedAtMs: number;
};

// This single PostgreSQL statement is an implicit transaction. The DELETE output is
// the *only* source for the UPDATE. There is no read-then-unconditional-write gap.
export async function consumeAndApply(verified: VerifiedOperation, preview?: Preview) {
  const { envelope, deploymentId, agent, notAfterUnix, checkedBlock, checkedAtMs } = verified;
  const { runId, project } = parseResource(envelope.resource);
  const sql = database();
  if (preview) {
    const rows = await sql`
      WITH consumed AS (
        DELETE FROM challenges c WHERE c.nonce = ${envelope.nonce}
          AND c.service_id = 'bound.preview.v1' AND c.service_id = ${envelope.serviceId}
          AND c.agent = ${agent.toLowerCase()} AND c.deployment_id = ${deploymentId}
          AND c.run_id = ${runId}::uuid AND c.expires_at > clock_timestamp()
          AND to_timestamp(${envelope.requestExpiresAtUnix}) <= c.expires_at
          AND to_timestamp(${envelope.requestExpiresAtUnix}) > clock_timestamp()
          AND to_timestamp(${notAfterUnix}) > clock_timestamp()
          AND to_timestamp(${checkedAtMs / 1000}) BETWEEN clock_timestamp() - interval '5 seconds' AND clock_timestamp() + interval '5 seconds'
          AND EXISTS (SELECT 1 FROM sessions s WHERE s.run_id = c.run_id
            AND s.deployment_id = c.deployment_id AND s.expires_at > clock_timestamp())
          AND EXISTS (SELECT 1 FROM previews p WHERE p.run_id = c.run_id AND p.project = ${project})
          AND EXISTS (SELECT 1 FROM runtime_state r WHERE r.key = ${`head:${deploymentId}:${envelope.serviceId}`}
            AND (r.value->>'block')::bigint = ${checkedBlock.toString()}::bigint)
        RETURNING run_id
      )
      UPDATE previews p SET title = ${preview.title}, body = ${preview.body},
        revision = p.revision + 1, updated_at = clock_timestamp()
      FROM consumed c WHERE p.run_id = c.run_id AND p.project = ${project}
        AND to_timestamp(${envelope.requestExpiresAtUnix}) > clock_timestamp()
        AND to_timestamp(${notAfterUnix}) > clock_timestamp()
      RETURNING p.title, p.body, p.revision
    `;
    return rows[0] ?? null;
  }
  const rows = await sql`
    DELETE FROM challenges c WHERE c.nonce = ${envelope.nonce}
      AND c.service_id = 'bound.content.v1' AND c.service_id = ${envelope.serviceId}
      AND c.agent = ${agent.toLowerCase()} AND c.deployment_id = ${deploymentId} AND c.run_id = ${runId}::uuid
      AND c.expires_at > clock_timestamp()
      AND to_timestamp(${envelope.requestExpiresAtUnix}) <= c.expires_at
      AND to_timestamp(${envelope.requestExpiresAtUnix}) > clock_timestamp()
      AND to_timestamp(${notAfterUnix}) > clock_timestamp()
      AND to_timestamp(${checkedAtMs / 1000}) BETWEEN clock_timestamp() - interval '5 seconds' AND clock_timestamp() + interval '5 seconds'
      AND EXISTS (SELECT 1 FROM sessions s WHERE s.run_id = c.run_id AND s.deployment_id = c.deployment_id AND s.expires_at > clock_timestamp())
      AND EXISTS (SELECT 1 FROM runtime_state r WHERE r.key = ${`head:${deploymentId}:${envelope.serviceId}`}
        AND (r.value->>'block')::bigint = ${checkedBlock.toString()}::bigint)
    RETURNING nonce
  `;
  return rows[0] ?? null;
}

export async function observeHead(deploymentId: string, serviceId: ServiceId, block: bigint) {
  const sql = database();
  const rows = await sql`
    INSERT INTO runtime_state(key, value) VALUES (${`head:${deploymentId}:${serviceId}`}, jsonb_build_object('block', ${block.toString()}::bigint::text))
    ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('block',
      greatest((runtime_state.value->>'block')::bigint, ${block.toString()}::bigint)::text), updated_at = clock_timestamp()
    RETURNING value->>'block' AS block
  `;
  return BigInt(rows[0]!.block as string) === block;
}

export async function startSession(deploymentId: string, initial: Record<'atlas' | 'boreal', Preview>) {
  const sql = database();
  const runId = randomUUID();
  const rows = await sql`
    WITH slot AS (
      INSERT INTO runtime_state(key, value)
      VALUES (${`demo:${deploymentId}`}, jsonb_build_object('runId', ${runId}::text, 'expires', extract(epoch FROM clock_timestamp()) + 300))
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = clock_timestamp()
      WHERE (runtime_state.value->>'expires')::numeric <= extract(epoch FROM clock_timestamp())
      RETURNING key
    ), session AS (
      INSERT INTO sessions(run_id, deployment_id, expires_at)
      SELECT ${runId}::uuid, ${deploymentId}, clock_timestamp() + interval '5 minutes' FROM slot RETURNING run_id, expires_at
    ), seed AS (
      INSERT INTO previews(run_id, project, title, body)
      SELECT run_id, 'atlas', ${initial.atlas.title}, ${initial.atlas.body} FROM session
      UNION ALL SELECT run_id, 'boreal', ${initial.boreal.title}, ${initial.boreal.body} FROM session RETURNING run_id
    ) SELECT s.run_id, s.expires_at FROM session s WHERE (SELECT count(*) FROM seed) = 2
  `;
  if (!rows[0]) return null;
  // Bounded cleanup, outside the authorization path. Keep pending chain operations.
  await sql`
    DELETE FROM sessions WHERE run_id IN (
      SELECT s.run_id FROM sessions s WHERE s.expires_at < clock_timestamp() - interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM chain_operations o WHERE o.run_id = s.run_id AND o.status IN ('preparing','prepared','submitted'))
      LIMIT 20
    )
  `;
  return { runId, expiresAt: new Date(String(rows[0].expires_at)).toISOString() };
}
