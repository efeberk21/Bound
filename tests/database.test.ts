import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { database } from '../packages/core/src/db.js';
import { challengeExists, consumeAndApply, issueChallenge, observeHead, type VerifiedOperation } from '../packages/core/src/runtime.js';
import type { Envelope } from '../packages/core/src/contracts.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const deploymentId = `db-test-${randomUUID()}`;
const runId = randomUUID();
const agent = '0x1111111111111111111111111111111111111111';
const resource = `demo://bound/${runId}/atlas`;
const serviceId = 'bound.preview.v1';
const sql = database();

async function operation(): Promise<VerifiedOperation> {
  const challenge = await issueChallenge({resource, agent, deploymentId, serviceId});
  const envelope: Envelope = {resource,serviceId,action:'preview.update',nonce:challenge.nonce,
    grantKey:`0x${'22'.repeat(32)}`, bodyHash:`0x${'33'.repeat(32)}`,
    requestExpiresAtUnix:challenge.expiresAtUnix};
  const clock = await sql`SELECT extract(epoch FROM clock_timestamp()) * 1000 AS now_ms`;
  const checkedAtMs = Number(clock[0]!.now_ms);
  return {envelope,agent,deploymentId,notAfterUnix:Math.floor(checkedAtMs/1000)+60,checkedBlock:10n,checkedAtMs};
}
async function revision() {
  const rows = await sql`SELECT revision FROM previews WHERE run_id = ${runId}::uuid AND project = 'atlas'`;
  return Number(rows[0]!.revision);
}
async function worker(input: VerifiedOperation) {
  return new Promise<{applied:boolean}>((resolve,reject) => {
    const process = spawn(globalThis.process.execPath, ['--import','tsx','tests/db-worker.ts'], {stdio:['pipe','pipe','pipe']});
    let output = '';
    process.stdout.on('data', chunk => {output += String(chunk);});
    process.on('error', reject);
    process.on('exit', code => {
      if (code !== 0) reject(new Error('DB worker failed (details redacted)'));
      else { try {resolve(JSON.parse(output));} catch {reject(new Error('DB worker output invalid'));} }
    });
    process.stdin.end(JSON.stringify(input, (_key,value) => typeof value === 'bigint' ? value.toString() : value));
  });
}

describe.sequential('Neon runtime transactions (real database)', () => {
  beforeAll(async () => {
    await sql`INSERT INTO sessions(run_id,deployment_id,expires_at) VALUES (${runId}::uuid,${deploymentId},clock_timestamp()+interval '5 minutes')`;
    await sql`INSERT INTO previews(run_id,project,title,body) VALUES (${runId}::uuid,'atlas','Before','Original content.')`;
    await observeHead(deploymentId,serviceId,10n);
  });
  afterAll(async () => {
    await sql`DELETE FROM sessions WHERE run_id = ${runId}::uuid`;
    await sql`DELETE FROM runtime_state WHERE key IN (${`head:${deploymentId}:${serviceId}`},${`challenges:${deploymentId}:${runId}:${serviceId}`})`;
  });
  it('one of two independent processes consumes a nonce and updates once', async () => {
    const op = await operation();
    const before = await revision();
    const results = await Promise.all([worker(op),worker(op)]);
    expect(results.filter(result=>result.applied)).toHaveLength(1);
    expect(await revision()).toBe(before+1);
    expect(await challengeExists(op.envelope,agent,deploymentId)).toBe(false);
  }, 20000);
  it('a new process cannot replay a previously consumed request', async () => {
    const op = await operation();
    expect((await worker(op)).applied).toBe(true);
    const before = await revision();
    expect((await worker(op)).applied).toBe(false);
    expect(await revision()).toBe(before);
  }, 15000);
  it('an unused valid nonce survives process restart', async () => {
    const op = await operation();
    expect(await challengeExists(op.envelope,agent,deploymentId)).toBe(true);
    expect((await worker(op)).applied).toBe(true);
  },15000);
  it('a preview constraint failure rolls the nonce deletion back', async () => {
    const op = await operation();
    const before = await revision();
    await expect(consumeAndApply(op,{title:'x'.repeat(81),body:'Constraint failure'})).rejects.toBeDefined();
    expect(await challengeExists(op.envelope,agent,deploymentId)).toBe(true);
    expect(await revision()).toBe(before);
  });
  it('request/policy expiry and wrong agent do not cause a write', async () => {
    const op = await operation();
    const before = await revision();
    expect(await consumeAndApply({...op,notAfterUnix:1},{title:'No',body:'Must not write'})).toBeNull();
    expect(await consumeAndApply({...op,envelope:{...op.envelope,requestExpiresAtUnix:1}},{title:'No',body:'Must not write'})).toBeNull();
    expect(await consumeAndApply({...op,agent:'0x2222222222222222222222222222222222222222'},{title:'No',body:'Must not write'})).toBeNull();
    expect(await revision()).toBe(before);
    expect(await challengeExists(op.envelope,agent,deploymentId)).toBe(true);
  });
  it('database state rejects an older verification after another process sees a higher head', async () => {
    const op = await operation();
    const before = await revision();
    expect(await observeHead(deploymentId,serviceId,11n)).toBe(true);
    expect(await observeHead(deploymentId,serviceId,10n)).toBe(false);
    expect(await consumeAndApply(op,{title:'No',body:'Old head'})).toBeNull();
    expect(await revision()).toBe(before);
  });
});
