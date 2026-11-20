import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function addProductionD1Binding(config, {
  configPath,
  databaseName,
  databaseId,
  migrationsDir = "migrations",
  migrationsPattern,
  projectRoot = process.cwd(),
}) {
  const name = databaseName?.trim();
  const id = databaseId?.trim();

  if (!name || !DATABASE_NAME_PATTERN.test(name)) {
    throw new Error("CLOUDFLARE_D1_DATABASE_NAME is missing or invalid.");
  }
  if (!id || !UUID_PATTERN.test(id)) {
    throw new Error("CLOUDFLARE_D1_DATABASE_ID is missing or invalid.");
  }
  if (!configPath) throw new Error("Generated Wrangler config path is required.");
  if (typeof migrationsDir !== "string" || !migrationsDir.trim() || path.isAbsolute(migrationsDir)) {
    throw new Error("CLOUDFLARE_D1_MIGRATIONS_DIR must be a relative directory.");
  }

  const root = path.resolve(projectRoot);
  const migrationsPath = path.resolve(root, migrationsDir);
  const relativeToRoot = path.relative(root, migrationsPath);
  if (!relativeToRoot || relativeToRoot === ".." || relativeToRoot.startsWith(".." + path.sep)) {
    throw new Error("CLOUDFLARE_D1_MIGRATIONS_DIR must stay inside the repository.");
  }
  if (!fs.existsSync(migrationsPath) || !fs.statSync(migrationsPath).isDirectory()) {
    throw new Error("The configured D1 migrations directory is missing.");
  }
  const migrationsPathFromConfig = path.relative(
    path.dirname(path.resolve(configPath)),
    migrationsPath,
  ).split(path.sep).join("/");
  let migrationsPatternFromConfig;
  if (migrationsPattern !== undefined) {
    if (migrationsPattern !== "migrations/*/*.sql" || migrationsDir !== "migrations") {
      throw new Error("Only the reviewed nested Group 05/06 migration pattern is supported.");
    }
    const nestedSqlFiles = fs.readdirSync(migrationsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => fs.readdirSync(path.join(migrationsPath, entry.name))
        .filter((file) => file.endsWith(".sql"))
        .map((file) => `${entry.name}/${file}`))
      .sort();
    const expectedMigrations = [
      "group05/0005_memory_foundation.sql",
      "group06/0001_manager_core.sql",
      "group06/0002_task_retry_budget.sql",
      "group06/0003_task_queue_leases.sql",
      "group06/0004_devpilot_approvals.sql",
    ];
    if (JSON.stringify(nestedSqlFiles) !== JSON.stringify(expectedMigrations)) {
      throw new Error("The Group 05/06 migration set is incomplete or contains unreviewed SQL files.");
    }
    migrationsPatternFromConfig = `${migrationsPathFromConfig}/*/*.sql`;
  } else {
    const migrations = fs.readdirSync(migrationsPath).filter((file) => file.endsWith(".sql"));
    if (migrations.length === 0) {
      throw new Error("No SQL migrations were found in the configured D1 migrations directory.");
    }
  }

  const existing = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const d1_databases = existing.filter((binding) => binding?.binding !== "ACTION_DB");
  d1_databases.push({
    binding: "ACTION_DB",
    database_name: name,
    database_id: id,
    migrations_dir: migrationsPathFromConfig,
    ...(migrationsPatternFromConfig ? { migrations_pattern: migrationsPatternFromConfig } : {}),
  });

  const requiredSecrets = new Set(Array.isArray(config.secrets?.required) ? config.secrets.required : []);
  requiredSecrets.add("GROQ_API_KEY");
  requiredSecrets.add("LIZA_AUTH_EMAIL");
  requiredSecrets.add("LIZA_AUTH_PASSWORD_HASH");

  return {
    ...config,
    // Pin production deploys to the existing primary Worker; never use Nitro's auto-generated name.
    name: "bot-banter-room",
    d1_databases,
    triggers: { ...(config.triggers ?? {}), crons: [...new Set([...(config.triggers?.crons ?? []), "* * * * *"])] },
    secrets: { ...(config.secrets ?? {}), required: [...requiredSecrets] },
  };
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Usage: node scripts/configure-production-d1.mjs <generated-wrangler-config>");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const configured = addProductionD1Binding(config, {
    configPath,
    databaseName: process.env.CLOUDFLARE_D1_DATABASE_NAME,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    migrationsDir: process.env.CLOUDFLARE_D1_MIGRATIONS_DIR || "migrations",
    migrationsPattern: process.env.CLOUDFLARE_D1_MIGRATIONS_PATTERN,
  });
  fs.writeFileSync(configPath, JSON.stringify(configured, null, 2) + "\n");
  console.log("Injected ACTION_DB binding and scoped migrations path; database ID redacted.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to configure production D1 binding.");
    process.exitCode = 1;
  });
}
