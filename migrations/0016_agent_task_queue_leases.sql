-- Durable background Manager queue leases and heartbeat tracking.
ALTER TABLE agent_tasks ADD COLUMN lease_owner TEXT;
ALTER TABLE agent_tasks ADD COLUMN lease_expires_at TEXT;
ALTER TABLE agent_tasks ADD COLUMN heartbeat_at TEXT;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_queue_lease
  ON agent_tasks(status, lease_expires_at, created_at);
ALTER TABLE agent_tasks ADD COLUMN worker_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (worker_attempt_count BETWEEN 0 AND 2);
