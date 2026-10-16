import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { database } from "./db.js";

type SQL = ReturnType<typeof database>;

export async function applyMigrations(
  sql: SQL,
  options: { schema?: string; through?: string } = {},
) {
  // Tests can exercise upgrades in an isolated schema with the real driver.
  if (options.schema && !/^bound_test_[a-f0-9]+$/.test(options.schema))
    throw new Error("INVALID_TEST_SCHEMA");
  const run = async (statement: string) => {
    const queries = options.schema
      ? [sql.query(`SET LOCAL search_path TO "${options.schema}"`, [])]
      : [];
    return sql.transaction([...queries, sql.query(statement, [])]);
  };
  await run(`DO $bootstrap$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext(current_schema() || ':bound:migrations'));
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
    END
  $bootstrap$`);
  const directory = new URL("../../../migrations/", import.meta.url);
  const files = (await readdir(directory))
    .filter((file) => /^\d+_[a-z_]+\.sql$/.test(file))
    .sort();
  const applied: string[] = [];
  for (const version of files) {
    if (options.through && version > options.through) continue;
    const source = await readFile(new URL(version, directory), "utf8");
    const checksum = createHash("sha256")
      .update(source.replace(/\r\n/g, "\n"))
      .digest("hex");
    const body = source
      .trim()
      .replace(/^BEGIN;\s*/, "")
      .replace(/\s*COMMIT;$/, "");
    const tag = `$bound_${randomUUID().replaceAll("-", "")}$`;
    // One DO statement is one transaction even over the HTTP driver. The lock,
    // checksum check, schema changes and ledger entry commit or roll back together.
    await run(`DO ${tag}
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtext(current_schema() || ':bound:migrations'));
        IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='${version}') THEN
          IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='${version}' AND checksum='${checksum}') THEN
            RAISE EXCEPTION 'MIGRATION_CHECKSUM_MISMATCH';
          END IF;
          RETURN;
        END IF;
        ${body}
        INSERT INTO schema_migrations(version,checksum) VALUES ('${version}','${checksum}');
      END
    ${tag}`);
    applied.push(version);
  }
  return applied;
}
