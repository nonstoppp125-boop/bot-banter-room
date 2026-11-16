CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin','instagram','facebook','youtube','x','tiktok')),
  account_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account','post','campaign')),
  metric TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  source TEXT NOT NULL,
  value REAL NOT NULL CHECK (value >= 0),
  payload_json TEXT NOT NULL,
  CHECK (period_start <= period_end)
);

CREATE INDEX IF NOT EXISTS idx_analytics_platform_period
  ON analytics_snapshots (platform, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_analytics_account_entity
  ON analytics_snapshots (account_id, entity_id);
