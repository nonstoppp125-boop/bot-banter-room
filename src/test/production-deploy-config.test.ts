import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { addProductionD1Binding } from "../../scripts/configure-production-d1.mjs";

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doot-deploy-config-"));
  roots.push(root);
  const configDir = path.join(root, ".output", "server");
  const migrationsDir = path.join(root, "migrations");
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.writeFileSync(path.join(migrationsDir, "0001_init.sql"), "SELECT 1;");
  return {
    root,
    configPath: path.join(configDir, "wrangler.json"),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("production D1 config preparation", () => {
  it("adds exactly one ACTION_DB binding and resolves default migrations relative to generated config", () => {
    const { root, configPath } = fixture();
    const config = {
      name: "doot",
      ratelimits: [{ name: "CHAT_RATE_LIMITER", namespace_id: "1", simple: { limit: 30, period: 60 } }],
      d1_databases: [{ binding: "OTHER_DB", database_name: "other", database_id: "00000000-0000-0000-0000-000000000001" }],
    };

    const result = addProductionD1Binding(config, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      projectRoot: root,
    });

    expect(result.d1_databases).toHaveLength(2);
    expect(result.d1_databases.find((item) => item.binding === "ACTION_DB")).toMatchObject({
      binding: "ACTION_DB",
      database_name: "doot-production",
      database_id: "123e4567-e89b-12d3-a456-426614174000",
      migrations_dir: "../../migrations",
    });
    expect(result.d1_databases.some((item) => item.binding === "OTHER_DB")).toBe(true);
    expect(result.secrets.required).toContain("GROQ_API_KEY");
    expect(result.triggers.crons).toContain("* * * * *");
  });

  it("limits ACTION_DB to the explicitly selected group migration directory", () => {
    const { root, configPath } = fixture();
    const groupMigrations = path.join(root, "migrations", "group05");
    fs.mkdirSync(groupMigrations, { recursive: true });
    fs.writeFileSync(path.join(groupMigrations, "0005_memory_foundation.sql"), "SELECT 1;");

    const result = addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      migrationsDir: "migrations/group05",
      projectRoot: root,
    });

    expect(result.d1_databases[0]).toMatchObject({
      binding: "ACTION_DB",
      migrations_dir: "../../migrations/group05",
    });
  });

  it("keeps the Group 05 migration limited to identity, session, memory and login-throttling tables", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/group05/0005_memory_foundation.sql"),
      "utf8",
    );
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map((match) => match[1]);

    expect(tables).toEqual(["users", "workspaces", "workspace_members", "sessions", "memories", "auth_login_attempts"]);
    expect(sql).not.toMatch(/agent_tasks|approvals|app_connections|social_accounts|content_drafts|publications|audit_events/);
  });

  it("supports ordered nested Group 05 and Group 06 migration directories", () => {
    const { root, configPath } = fixture();
    const group05 = path.join(root, "migrations", "group05");
    const group06 = path.join(root, "migrations", "group06");
    fs.mkdirSync(group05, { recursive: true });
    fs.mkdirSync(group06, { recursive: true });
    fs.writeFileSync(path.join(group05, "0005_memory_foundation.sql"), "SELECT 1;");
    fs.writeFileSync(path.join(group06, "0001_manager_core.sql"), "SELECT 1;");
    fs.writeFileSync(path.join(group06, "0002_task_retry_budget.sql"), "SELECT 1;");
    fs.writeFileSync(path.join(group06, "0003_task_queue_leases.sql"), "SELECT 1;");

    const result = addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      migrationsDir: "migrations",
      migrationsPattern: "migrations/*/*.sql",
      projectRoot: root,
    });

    expect(result.d1_databases[0]).toMatchObject({
      binding: "ACTION_DB",
      migrations_dir: "../../migrations",
      migrations_pattern: "../../migrations/*/*.sql",
    });
  });

  it("replaces an existing ACTION_DB binding instead of creating duplicates", () => {
    const { root, configPath } = fixture();
    const result = addProductionD1Binding({
      d1_databases: [{ binding: "ACTION_DB", database_name: "old", database_id: "00000000-0000-0000-0000-000000000001" }],
    }, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      projectRoot: root,
    });

    expect(result.d1_databases.filter((item) => item.binding === "ACTION_DB")).toHaveLength(1);
    expect(result.d1_databases[0]?.database_name).toBe("doot-production");
  });

  it("rejects missing or malformed database identifiers", () => {
    const { root, configPath } = fixture();
    expect(() => addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "",
      projectRoot: root,
    })).toThrow("CLOUDFLARE_D1_DATABASE_ID");
    expect(() => addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "not-a-uuid",
      projectRoot: root,
    })).toThrow("CLOUDFLARE_D1_DATABASE_ID");
  });

  it("rejects migration paths outside the repository", () => {
    const { root, configPath } = fixture();
    expect(() => addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      migrationsDir: "../outside",
      projectRoot: root,
    })).toThrow("must stay inside the repository");
  });

  it("refuses deployment configuration when the selected migrations directory is absent", () => {
    const { root, configPath } = fixture();
    fs.rmSync(path.join(root, "migrations"), { recursive: true, force: true });
    expect(() => addProductionD1Binding({}, {
      configPath,
      databaseName: "doot-production",
      databaseId: "123e4567-e89b-12d3-a456-426614174000",
      projectRoot: root,
    })).toThrow("migrations directory");
  });
});
