import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { database } from "../packages/core/src/db.js";
import { applyMigrations } from "../packages/core/src/migrations.js";
import { cleanupRuntime } from "../packages/core/src/runtime.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const sql = database(process.env.DATABASE_URL_UNPOOLED);
const schema = `bound_test_${randomUUID().replaceAll("-", "")}`;
const runId = randomUUID(),
  pendingRun = randomUUID();
async function scoped(statement: string) {
  const rows = await sql.transaction([
    sql.query(`SET LOCAL search_path TO "${schema}"`, []),
    sql.query(statement, []),
  ]);
  return rows[1]!;
}
describe.sequential(
  "versioned migrations and cleanup (real SQL, isolated schema)",
  () => {
    beforeAll(async () => {
      await sql.query(`CREATE SCHEMA "${schema}"`, []);
    });
    afterAll(async () => {
      await sql.query(`DROP SCHEMA "${schema}" CASCADE`, []);
    });
    it("upgrades the existing schema and backfills legacy counters conservatively", async () => {
      await applyMigrations(sql, { schema, through: "001_runtime.sql" });
      await scoped(`INSERT INTO runtime_state(key,value,updated_at) VALUES
      ('challenges:old:orphan:content','{"count":3}',clock_timestamp()-interval '2 days'),
      ('head:deployment:content','{"block":"100"}',clock_timestamp()-interval '2 days')`);
      await applyMigrations(sql, { schema });
      const rows = await scoped(
        `SELECT expires_at IS NOT NULL AS has_expiry FROM runtime_state WHERE key='challenges:old:orphan:content'`,
      );
      expect(rows[0]?.has_expiry).toBe(true);
      const indices =
        await sql`SELECT indexname FROM pg_indexes WHERE schemaname=${schema}`;
      expect(
        indices.some((row) => row.indexname === "runtime_state_expiry"),
      ).toBe(true);
      expect(
        indices.some(
          (row) => row.indexname === "chain_operations_pending_session",
        ),
      ).toBe(true);
    }, 20000);
    it("repeating migrations preserves data and checksums", async () => {
      await applyMigrations(sql, { schema });
      expect(
        (
          await scoped("SELECT count(*)::int AS count FROM schema_migrations")
        )[0]?.count,
      ).toBe(3);
      await scoped(
        `UPDATE schema_migrations SET checksum='changed' WHERE version='002_runtime_expiry.sql'`,
      );
      await expect(applyMigrations(sql, { schema })).rejects.toThrow();
      // Restore the ledger for the following tests by reading the normalized source hash.
      const { readFile } = await import("node:fs/promises");
      const { createHash } = await import("node:crypto");
      const checksum = createHash("sha256")
        .update(
          (await readFile("migrations/002_runtime_expiry.sql", "utf8")).replace(
            /\r\n/g,
            "\n",
          ),
        )
        .digest("hex");
      await scoped(
        `UPDATE schema_migrations SET checksum='${checksum}' WHERE version='002_runtime_expiry.sql'`,
      );
    }, 20000);
    it("cleans expired counters and sessions while preserving high-water and pending operations", async () => {
      await scoped(`INSERT INTO sessions(run_id,deployment_id,created_at,expires_at) VALUES
      ('${runId}','cleanup',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days'),
      ('${pendingRun}','cleanup',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days')`);
      await scoped(`INSERT INTO chain_operations(id,run_id,resource,operation,signer,status,claim_token)
      VALUES ('${randomUUID()}','${pendingRun}','demo://bound/${pendingRun}/atlas','grant','0x${"11".repeat(20)}','preparing','${randomUUID()}')`);
      const scopedSql = ((strings: TemplateStringsArray) =>
        scoped(strings.join(""))) as typeof sql;
      await cleanupRuntime(scopedSql);
      const keys = await scoped("SELECT key FROM runtime_state");
      expect(keys.map((row) => row.key)).toEqual(["head:deployment:content"]);
      const sessions = await scoped("SELECT run_id FROM sessions");
      expect(sessions.map((row) => row.run_id)).toEqual([pendingRun]);
    });
    it("recovers TTL-less counters written by an older deployment after migration", async () => {
      await scoped(`INSERT INTO runtime_state(key,value,updated_at) VALUES
        ('challenges:rolling:expired','{}',clock_timestamp()-interval '2 days'),
        ('challenges:rolling:live','{}',clock_timestamp())`);
      const scopedSql = ((strings: TemplateStringsArray) =>
        scoped(strings.join(""))) as typeof sql;
      await cleanupRuntime(scopedSql);
      const rows = await scoped(
        `SELECT key,expires_at IS NOT NULL AS has_expiry FROM runtime_state WHERE key LIKE 'challenges:rolling:%'`,
      );
      expect(rows).toEqual([
        { key: "challenges:rolling:live", has_expiry: true },
      ]);
    });
    it("bounds counter cleanup batches and leaves unexpired counters intact", async () => {
      await scoped(
        `INSERT INTO runtime_state(key,value,expires_at) SELECT 'challenges:expired:'||i,'{}',clock_timestamp()-interval '2 days' FROM generate_series(1,45) i`,
      );
      await scoped(
        `INSERT INTO runtime_state(key,value,expires_at) VALUES ('challenges:live','{}',clock_timestamp()+interval '1 minute')`,
      );
      const scopedSql = ((strings: TemplateStringsArray) =>
        scoped(strings.join(""))) as typeof sql;
      await cleanupRuntime(scopedSql);
      expect(
        (
          await scoped(
            `SELECT count(*)::int AS count FROM runtime_state WHERE key LIKE 'challenges:expired:%'`,
          )
        )[0]?.count,
      ).toBe(5);
      expect(
        (
          await scoped(
            `SELECT count(*)::int AS count FROM runtime_state WHERE key='challenges:live'`,
          )
        )[0]?.count,
      ).toBe(1);
    });
  },
);
