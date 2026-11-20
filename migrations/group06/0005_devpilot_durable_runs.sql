-- Durable DevPilot run checkpoints, worker leases and append-only evidence events.
CREATE TABLE IF NOT EXISTS devpilot_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  task_text TEXT NOT NULL CHECK (length(task_text) BETWEEN 1 AND 4000),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'awaiting_approval', 'completed', 'blocked', 'failed', 'cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  checkpoint_version INTEGER NOT NULL DEFAULT 0 CHECK (checkpoint_version >= 0),
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  lease_owner TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devpilot_runs_queue_lease
  ON devpilot_runs(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_devpilot_runs_user
  ON devpilot_runs(workspace_id, user_id, created_at);
CREATE TABLE IF NOT EXISTS devpilot_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES devpilot_runs(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('planned', 'proposal-created', 'reviewed', 'verified', 'blocked', 'checkpoint', 'approval')),
  timestamp TEXT NOT NULL,
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
  evidence_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_devpilot_events_run
  ON devpilot_events(run_id, timestamp, id);
