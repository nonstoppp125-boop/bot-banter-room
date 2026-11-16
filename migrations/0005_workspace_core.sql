PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deletion_requested_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','needs_approval')),
  input_summary TEXT NOT NULL,
  plan_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired')),
  decided_by_user_id TEXT REFERENCES users(id),
  decision_reason TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS app_connections (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  encrypted_token_blob BLOB,
  token_expires_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','connected','expired','revoked','error')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id TEXT REFERENCES app_connections(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_account_id TEXT,
  account_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pending_approval','approved','rejected','scheduled','published','failed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_by_user_id TEXT REFERENCES users(id),
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_publication_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','publishing','published','failed')),
  published_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memories_user_workspace ON memories(user_id, workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace ON agent_tasks(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approvals(workspace_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_connections_workspace ON app_connections(workspace_id, provider, status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace ON social_accounts(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_drafts_workspace ON content_drafts(workspace_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_publications_workspace ON publications(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id, created_at);
