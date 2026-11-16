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
  it("adds exactly one ACTION_DB binding and resolves migrations relative to generated config", () => {
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

  it("refuses deployment configuration when migrations are absent", () => {
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
