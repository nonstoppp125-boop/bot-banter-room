-- Durable, owner-scoped DevPilot checkpoints and append-only execution evidence.
CREATE TABLE IF NOT EXISTS devpilot_checkpoints (
  task_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('planned', 'awaiting_approval', 'running', 'paused', 'blocked', 'failed', 'completed', 'cancelled')),
  stage TEXT NOT NULL CHECK (stage IN ('inspection', 'planning', 'approval', 'execution', 'validation', 'review', 'delivery', 'complete')),
  progress INTEGER NOT NULL CHECK (progress IN (0, 10, 25, 50, 75, 90, 100)),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 2),
  repository TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  target_branch TEXT,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devpilot_checkpoints_owner_updated
  ON devpilot_checkpoints(workspace_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS devpilot_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('planned', 'proposal-created', 'approval-requested', 'approval-granted', 'execution-started', 'command-started', 'command-completed', 'reviewed', 'verified', 'paused', 'resumed', 'blocked', 'failed', 'cancelled', 'completed')),
  progress INTEGER CHECK (progress IS NULL OR progress IN (0, 10, 25, 50, 75, 90, 100)),
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES devpilot_checkpoints(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devpilot_events_task_created
  ON devpilot_task_events(task_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_devpilot_events_owner_task
  ON devpilot_task_events(workspace_id, user_id, task_id, created_at);
