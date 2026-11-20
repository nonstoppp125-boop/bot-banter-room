-- Durable, workspace-scoped approvals for exact DevPilot code proposals.
CREATE TABLE IF NOT EXISTS devpilot_approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by_user_id TEXT,
  decision_reason TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_devpilot_approvals_workspace_status
  ON devpilot_approvals(workspace_id, status, expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_devpilot_approvals_task
  ON devpilot_approvals(task_id, workspace_id);
