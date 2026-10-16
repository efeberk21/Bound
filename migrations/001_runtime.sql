BEGIN;

-- Only operational state lives in SQL. Arkiv remains the grant authority.
CREATE TABLE IF NOT EXISTS sessions (
  run_id uuid PRIMARY KEY,
  deployment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  model_calls integer NOT NULL DEFAULT 0 CHECK (model_calls BETWEEN 0 AND 2),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS challenges (
  nonce text PRIMARY KEY CHECK (nonce ~ '^0x[0-9a-f]{64}$'),
  service_id text NOT NULL CHECK (service_id IN ('bound.content.v1', 'bound.preview.v1')),
  agent text NOT NULL CHECK (agent ~ '^0x[0-9a-f]{40}$'),
  deployment_id text NOT NULL,
  run_id uuid NOT NULL REFERENCES sessions(run_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at <= created_at + interval '30 seconds'),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS challenges_quota ON challenges(deployment_id, run_id, service_id, created_at);
CREATE TABLE IF NOT EXISTS previews (
  run_id uuid NOT NULL REFERENCES sessions(run_id) ON DELETE CASCADE,
  project text NOT NULL CHECK (project IN ('atlas', 'boreal')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id, project)
);
CREATE TABLE IF NOT EXISTS chain_operations (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES sessions(run_id) ON DELETE CASCADE,
  resource text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('grant', 'revoke', 'forged', 'expiry')),
  signer text NOT NULL CHECK (signer ~ '^0x[0-9a-f]{40}$'),
  status text NOT NULL CHECK (status IN ('preparing', 'prepared', 'submitted', 'confirmed', 'failed')),
  claim_token uuid NOT NULL,
  raw_transaction text,
  transaction_hash text,
  entity_key text,
  block_number bigint,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (run_id, resource, operation),
  CHECK ((raw_transaction IS NULL) = (transaction_hash IS NULL)),
  CHECK (status NOT IN ('prepared', 'submitted', 'confirmed') OR raw_transaction IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_operation_per_signer
  ON chain_operations(signer) WHERE status IN ('preparing', 'prepared', 'submitted');
CREATE TABLE IF NOT EXISTS runtime_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMIT;
