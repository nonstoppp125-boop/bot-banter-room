import fs from "node:fs";
import path from "node:path";

const [configPath] = process.argv.slice(2);
if (!configPath) {
  throw new Error("Usage: node scripts/configure-group05-production.mjs <generated-wrangler-config>");
}

const required = [
  "CLOUDFLARE_D1_DATABASE_NAME",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CF_ACCESS_TEAM_DOMAIN",
  "CF_ACCESS_AUD",
  "CF_ACCESS_ALLOWED_EMAIL_DOMAINS",
];
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required environment variable: ${key}`);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(process.env.CLOUDFLARE_D1_DATABASE_ID)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID is not a valid UUID.");
}
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(process.env.CLOUDFLARE_D1_DATABASE_NAME)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_NAME is invalid.");
}

const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN.trim().toLowerCase();
if (
  teamDomain.length > 253 ||
  !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(teamDomain) ||
  teamDomain.includes("..")
) {
  throw new Error("CF_ACCESS_TEAM_DOMAIN is invalid.");
}
const audience = process.env.CF_ACCESS_AUD.trim();
if (audience.length > 512) throw new Error("CF_ACCESS_AUD is invalid.");

const allowedDomains = process.env.CF_ACCESS_ALLOWED_EMAIL_DOMAINS
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);
if (
  allowedDomains.length === 0 ||
  allowedDomains.some((domain) =>
    domain.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) ||
    domain.includes("..")
  )
) {
  throw new Error("CF_ACCESS_ALLOWED_EMAIL_DOMAINS must contain valid comma-separated email domains.");
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const bindings = Array.isArray(config.d1_databases) ? config.d1_databases : [];
config.d1_databases = bindings.filter((item) => item.binding !== "ACTION_DB");
const migrationDir = path.relative(
  path.dirname(path.resolve(configPath)),
  path.resolve("migrations/group05"),
).split(path.sep).join("/");
if (!migrationDir || path.isAbsolute(migrationDir)) {
  throw new Error("Could not resolve the isolated Group 05 migration directory.");
}
const resolvedMigrationDir = path.resolve(path.dirname(path.resolve(configPath)), migrationDir);
const expectedMigrationDir = path.resolve("migrations/group05");
if (resolvedMigrationDir !== expectedMigrationDir || !fs.statSync(resolvedMigrationDir).isDirectory()) {
  throw new Error("Resolved migration directory is not the isolated Group 05 directory.");
}
const migrationFiles = fs.readdirSync(resolvedMigrationDir).filter((name) => name.endsWith(".sql"));
if (migrationFiles.length !== 1 || migrationFiles[0] !== "0005_memory_foundation.sql") {
  throw new Error("Refusing to configure unexpected Group 05 migration files.");
}
config.d1_databases.push({
  binding: "ACTION_DB",
  database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME,
  database_id: process.env.CLOUDFLARE_D1_DATABASE_ID,
  migrations_dir: migrationDir,
});
config.vars = {
  ...(config.vars ?? {}),
  CF_ACCESS_TEAM_DOMAIN: teamDomain,
  CF_ACCESS_AUD: audience,
  CF_ACCESS_ALLOWED_EMAIL_DOMAINS: allowedDomains.join(","),
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Configured ACTION_DB with the isolated Group 05 migration directory and Cloudflare Access variables.");
