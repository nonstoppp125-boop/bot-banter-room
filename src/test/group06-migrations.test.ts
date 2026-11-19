import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const MIGRATIONS = [
  "migrations/group05/0005_memory_foundation.sql",
  "migrations/group06/0001_manager_core.sql",
  "migrations/group06/0002_task_retry_budget.sql",
  "migrations/group06/0003_task_queue_leases.sql",
] as const;

function columns(database: DatabaseSync, table: string): string[] {
  const rows = database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

describe("Group 05/06 production D1 migration contract", () => {
  it("applies the exact nested migration sequence to SQLite and creates the schema expected by runtime stores", () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const migration of MIGRATIONS) {
        const sql = fs.readFileSync(path.resolve(process.cwd(), migration), "utf8");
        database.exec(sql);
      }

      expect(columns(database, "auth_login_attempts")).toEqual(
        expect.arrayContaining(["email_hash", "window_started_at", "attempts"]),
      );
      expect(columns(database, "agent_tasks")).toEqual(expect.arrayContaining([
        "id", "workspace_id", "user_id", "status", "input_summary", "plan_json",
        "result_json", "created_at", "updated_at", "attempt_count", "lease_owner",
        "lease_expires_at", "heartbeat_at", "worker_attempt_count",
      ]));
      expect(columns(database, "approvals")).toEqual(expect.arrayContaining([
        "id", "workspace_id", "user_id", "task_id", "action_type", "payload_hash",
        "summary", "status", "decided_by_user_id", "decision_reason", "expires_at",
        "created_at", "decided_at",
      ]));
      expect(columns(database, "action_claims")).toEqual(["idempotency_key", "claimed_at"]);
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });
});
