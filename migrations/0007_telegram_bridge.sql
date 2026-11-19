CREATE TABLE IF NOT EXISTS telegram_user_links (
  bot_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (bot_id, telegram_user_id)
);
CREATE INDEX IF NOT EXISTS idx_telegram_user_links_owner
  ON telegram_user_links (user_id, workspace_id, status);

CREATE TABLE IF NOT EXISTS telegram_update_claims (
  bot_id TEXT NOT NULL,
  update_id INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (bot_id, update_id)
);
CREATE INDEX IF NOT EXISTS idx_telegram_update_claims_expiry
  ON telegram_update_claims (expires_at);
