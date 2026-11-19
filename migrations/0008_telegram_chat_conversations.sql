CREATE TABLE IF NOT EXISTS telegram_chat_conversations (
  bot_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (bot_id, telegram_chat_id),
  FOREIGN KEY (bot_id, telegram_user_id)
    REFERENCES telegram_user_links(bot_id, telegram_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_telegram_chat_conversations_owner
  ON telegram_chat_conversations (user_id, workspace_id, updated_at);
