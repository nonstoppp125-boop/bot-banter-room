CREATE TABLE IF NOT EXISTS webhook_event_claims (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_claim_expiry
  ON webhook_event_claims (expires_at);
