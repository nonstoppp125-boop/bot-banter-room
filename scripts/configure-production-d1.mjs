import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function addProductionD1Binding(config, {
  configPath,
  databaseName,
  databaseId,
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

  const migrationsPath = path.resolve(projectRoot, "migrations");
  if (!fs.existsSync(migrationsPath)) {
    throw new Error("The tracked migrations directory is missing.");
  }
  const migrations = fs.readdirSync(migrationsPath).filter((file) => file.endsWith(".sql"));
  if (migrations.length === 0) {
    throw new Error("No SQL migrations were found; refusing production deployment.");
  }

  const migrationsDir = path.relative(
    path.dirname(path.resolve(configPath)),
    migrationsPath,
  ).split(path.sep).join("/");

  const existing = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const d1_databases = existing.filter((binding) => binding?.binding !== "ACTION_DB");
  d1_databases.push({
    binding: "ACTION_DB",
    database_name: name,
    database_id: id,
    migrations_dir: migrationsDir,
  });

  const requiredSecrets = new Set(Array.isArray(config.secrets?.required) ? config.secrets.required : []);
  requiredSecrets.add("GROQ_API_KEY");

  return {
    ...config,
    d1_databases,
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
  });
  fs.writeFileSync(configPath, JSON.stringify(configured, null, 2) + "\n");
  console.log("Injected ACTION_DB binding and migrations path; database ID redacted.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to configure production D1 binding.");
    process.exitCode = 1;
  });
}
