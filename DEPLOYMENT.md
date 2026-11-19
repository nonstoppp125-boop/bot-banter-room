# Production Deployment Setup

Production deployment is manual and fail-closed. The workflow runs only on `main` when `confirm_deploy=true`; it never deploys directly from a work branch.

## 1. Cloudflare D1 database

Use the existing production D1 database for this Worker, or create one in the same Cloudflare account. Record its exact database name and UUID from Cloudflare.

The deployment workflow configures the generated Wrangler file with the `ACTION_DB` binding and the reviewed nested migration pattern. It applies these migrations in order:

1. `migrations/group05/0005_memory_foundation.sql` — users, workspaces, memberships, sessions, memories and login-throttling records.
2. `migrations/group06/0001_manager_core.sql` — durable Manager tasks, approvals and idempotency claims.
3. `migrations/group06/0002_task_retry_budget.sql` — bounded manual retry counter.
4. `migrations/group06/0003_task_queue_leases.sql` — worker lease, heartbeat and bounded background-attempt fields.

The workflow fails closed unless this exact four-file set is present. Legacy root-level SQL files under `migrations/*.sql` are not part of this production migration sequence; do not apply them manually. Wrangler creates a D1 backup when applying remote migrations.

**Migration-history note:** the previous Group 05 deployment used `migrations/group05` as its `migrations_dir`; the new combined configuration uses the repository `migrations` root and records nested paths relative to that root. Cloudflare may therefore see `group05/0005_memory_foundation.sql` as a new migration name and run that Group 05 SQL once more. It contains only `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements and is idempotent, but inspect the production `d1_migrations` table and pending migration list before applying anything.

## 2. GitHub Environment secrets

Under repository Settings → Environments → `production`, configure:

- `CLOUDFLARE_API_TOKEN` — token with Workers deployment and D1 migration permissions.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CLOUDFLARE_D1_DATABASE_NAME` — exact production D1 database name.
- `CLOUDFLARE_D1_DATABASE_ID` — exact production D1 UUID.

The workflow does not create a database or invent an ID. It stops before migration/deployment if any value is absent or invalid.

## 3. Cloudflare Worker secrets

Configure these Worker secrets before deployment:

- `GROQ_API_KEY` — required model-provider key.
- `LIZA_AUTH_EMAIL` — the private workspace owner login email.
- `LIZA_AUTH_PASSWORD_HASH` — PBKDF2-SHA256 password hash, 100,000 iterations.

Generate the password hash locally in an interactive terminal with:

```sh
node scripts/generate-password-hash.mjs
```

The script does not echo the password and refuses piped input. Store the generated hash directly as the Cloudflare Worker secret; never commit it or paste the password/hash into chat.

Optional Worker secrets include `TAVILY_API_KEY` for research and Telegram bot/webhook credentials when that integration is configured. First-party password authentication does not require Cloudflare Access team-domain or audience variables.

## 4. Deployment gate

Before production deployment:

1. Confirm all four GitHub production-environment secrets are configured.
2. Confirm all three required Worker secrets are configured.
3. Confirm the D1 database name and UUID match the intended production database.
4. Review the exact four Group 05/06 migration files and the generated Wrangler config.
5. Merge only the reviewed, reconciled branch after its exact-head CI passes.
6. Manually run **Doot Manual Cloudflare Deploy** on `main` with `confirm_deploy=true`.

The workflow runs locked install, production dependency audit, typecheck, all tests, build, D1 config injection/validation, remote migrations and Worker deployment. Any failed check or migration stops the release.

No production migration or deployment is triggered merely by updating this document or a work branch.
