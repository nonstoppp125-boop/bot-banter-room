-- Scope persisted analytics to the authenticated workspace. Existing unscoped
-- snapshots remain NULL and are intentionally invisible to workspace-scoped reads.
ALTER TABLE analytics_snapshots
  ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_analytics_workspace_period
  ON analytics_snapshots (workspace_id, period_start, captured_at);
