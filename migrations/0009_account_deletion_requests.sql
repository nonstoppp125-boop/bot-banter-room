CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmed_by_user_id TEXT NOT NULL REFERENCES users(id),
  confirmed_at TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','cancelled','completed')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_status ON account_deletion_requests(user_id, status, scheduled_for);
