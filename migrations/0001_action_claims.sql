CREATE TABLE IF NOT EXISTS action_claims (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_claims_claimed_at
  ON action_claims (claimed_at);
