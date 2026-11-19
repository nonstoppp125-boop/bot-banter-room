import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Group 05/06 production D1 migration contract", () => {
  it("applies the exact nested migration sequence to SQLite and creates the schema expected by runtime stores", () => {
    // Run node:sqlite in a child Node process so Vite does not try to bundle this Node-only built-in.
    const script = `
      import fs from "node:fs";
      import path from "node:path";
      import { DatabaseSync } from "node:sqlite";

      const database = new DatabaseSync(":memory:");
      const migrations = [
        "migrations/group05/0005_memory_foundation.sql",
        "migrations/group06/0001_manager_core.sql",
        "migrations/group06/0002_task_retry_budget.sql",
        "migrations/group06/0003_task_queue_leases.sql",
      ];
      const columns = (table) => database.prepare("PRAGMA table_info('" + table + "')").all().map((row) => row.name);
      try {
        for (const migration of migrations) {
          database.exec(fs.readFileSync(path.resolve(process.cwd(), migration), "utf8"));
        }
        const assertColumns = (table, expected) => {
          const actual = columns(table);
          const missing = expected.filter((column) => !actual.includes(column));
          if (missing.length) throw new Error(table + " missing columns: " + missing.join(", "));
        };
        assertColumns("auth_login_attempts", ["email_hash", "window_started_at", "attempts"]);
        assertColumns("agent_tasks", [
          "id", "workspace_id", "user_id", "status", "input_summary", "plan_json",
          "result_json", "created_at", "updated_at", "attempt_count", "lease_owner",
          "lease_expires_at", "heartbeat_at", "worker_attempt_count",
        ]);
        assertColumns("approvals", [
          "id", "workspace_id", "user_id", "task_id", "action_type", "payload_hash",
          "summary", "status", "decided_by_user_id", "decision_reason", "expires_at",
          "created_at", "decided_at",
        ]);
        assertColumns("action_claims", ["idempotency_key", "claimed_at"]);
        const violations = database.prepare("PRAGMA foreign_key_check").all();
        if (violations.length) throw new Error("Foreign key violations: " + JSON.stringify(violations));
        process.stdout.write("Group 05/06 SQLite migration contract passed.\\n");
      } finally {
        database.close();
      }
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("Group 05/06 SQLite migration contract passed.");
  });
});
