BEGIN;

-- An old function can still insert a counter without a TTL during a rolling
-- deployment after 002's backfill. Bound and index that compatibility sweep.
CREATE INDEX IF NOT EXISTS runtime_state_legacy_challenges ON runtime_state(updated_at, key)
WHERE expires_at IS NULL AND key LIKE 'challenges:%';

COMMIT;
