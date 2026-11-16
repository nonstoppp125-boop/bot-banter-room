-- Workspace administrators can explicitly remove imported analytics records.
ALTER TABLE analytics_snapshots ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_workspace_active_page
  ON analytics_snapshots (workspace_id, deleted_at, period_start, captured_at, id);
