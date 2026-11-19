ALTER TABLE oauth_transactions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
