-- Bounded user-triggered retry budget for failed Manager tasks.
ALTER TABLE agent_tasks
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2);
