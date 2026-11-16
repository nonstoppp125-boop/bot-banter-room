import fs from "node:fs";

const [configPath] = process.argv.slice(2);
if (!configPath) throw new Error("Usage: node scripts/configure-production-d1.mjs <generated-wrangler-config>");

const required = ["CLOUDFLARE_D1_DATABASE_NAME", "CLOUDFLARE_D1_DATABASE_ID"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(process.env.CLOUDFLARE_D1_DATABASE_ID)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID is not a valid UUID.");
}
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(process.env.CLOUDFLARE_D1_DATABASE_NAME)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_NAME is invalid.");
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const bindings = Array.isArray(config.d1_databases) ? config.d1_databases : [];
config.d1_databases = bindings.filter((item) => item.binding !== "ACTION_DB");
config.d1_databases.push({
  binding: "ACTION_DB",
  database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME,
  database_id: process.env.CLOUDFLARE_D1_DATABASE_ID,
});

// Group 03 currently does not execute D1-backed actions. Do not apply the
// repository-wide migrations directory: it contains later-group schemas.
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Injected ACTION_DB binding. No remote migrations were requested.");
