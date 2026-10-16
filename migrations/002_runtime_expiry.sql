BEGIN;

ALTER TABLE runtime_state ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Legacy challenge counters can outlive deleted sessions. Five minutes after
-- their last update is conservative: every demo session lasts at most five minutes.
UPDATE runtime_state SET expires_at = updated_at + interval '5 minutes'
WHERE key LIKE 'challenges:%' AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS runtime_state_expiry ON runtime_state(expires_at, key)
WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS chain_operations_pending_session ON chain_operations(run_id)
WHERE status IN ('preparing', 'prepared', 'submitted');

COMMIT;
