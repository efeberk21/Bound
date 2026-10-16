import { database } from "../packages/core/src/db.js";
import { applyMigrations } from "../packages/core/src/migrations.js";
try {
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (!direct) throw new Error("DATABASE_URL_UNPOOLED_REQUIRED");
  if (new URL(direct).hostname.includes("-pooler."))
    throw new Error("DIRECT_MIGRATION_URL_REQUIRED");
  const sql = database(direct);
  await applyMigrations(sql);
  console.log("BOUND runtime migration applied.");
} catch {
  console.error(
    "Migration failed. Check DATABASE_URL and the dedicated Neon project; credentials are not logged.",
  );
  process.exitCode = 1;
}
