CREATE TABLE IF NOT EXISTS linkedin_growth_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft', 'pending_approval', 'approved', 'rejected',
      'scheduled', 'publishing', 'published', 'failed'
    )
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scheduled_at TEXT,
  approved_by TEXT,
  published_at TEXT,
  publication_id TEXT,
  failure_reason TEXT,
  campaign TEXT,
  pillar TEXT
);

CREATE INDEX IF NOT EXISTS idx_linkedin_growth_drafts_status
  ON linkedin_growth_drafts(status);

CREATE INDEX IF NOT EXISTS idx_linkedin_growth_drafts_schedule
  ON linkedin_growth_drafts(scheduled_at);

CREATE TABLE IF NOT EXISTS linkedin_growth_audit (
  id TEXT PRIMARY KEY NOT NULL,
  draft_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  details_json TEXT NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES linkedin_growth_drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_growth_audit_draft_time
  ON linkedin_growth_audit(draft_id, timestamp);

CREATE TABLE IF NOT EXISTS linkedin_analytics_snapshots (
  post_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  impressions REAL,
  reach REAL,
  reactions REAL,
  comments REAL,
  shares REAL,
  clicks REAL,
  followers_gained REAL,
  campaign TEXT,
  pillar TEXT,
  PRIMARY KEY (post_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_analytics_captured_at
  ON linkedin_analytics_snapshots(captured_at);
