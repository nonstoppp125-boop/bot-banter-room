# Production Deployment Setup

The production workflow is intentionally manual and fail-closed. It runs only on main when confirm_deploy=true. It does not run from work/group06-manager-planner.

## 1. Create the D1 database

Create the production D1 database in the same Cloudflare account as the Worker, using the Cloudflare dashboard or Wrangler. Record the exact database name and UUID returned by Cloudflare. Do not invent or reuse an ID from another project.

The repository contains 15 SQL migrations under migrations/. The deploy workflow injects the real D1 binding into the Nitro-generated Wrangler config, points migrations_dir at the tracked migration folder, applies pending migrations to the remote database, then deploys. Wrangler captures a D1 backup when migrations are applied.

## 2. Configure GitHub Environment secrets

The workflow uses GitHub Environment production. Add these environment secrets under repository Settings → Environments → production:

- CLOUDFLARE_API_TOKEN — token with the required Workers deployment and D1 permissions.
- CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID.
- CLOUDFLARE_D1_DATABASE_NAME — exact created D1 database name.
- CLOUDFLARE_D1_DATABASE_ID — exact D1 UUID.

The workflow does not create a D1 database automatically. It fails before migration/deployment if these values are absent or invalid.

## 3. Configure Worker runtime values

In the Cloudflare Worker settings, configure:

- Required Worker secret: GROQ_API_KEY. The generated Wrangler config declares this secret as required, and Wrangler validates it before deployment.
- Required Access variables: CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.
- Recommended Access allowlist variable: CF_ACCESS_ALLOWED_EMAIL_DOMAINS.
- Optional research secret: TAVILY_API_KEY.
- Optional Telegram values: TELEGRAM_BOT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_APPROVAL_CALLBACK_SECRET.
- OAuth provider credentials are needed only when a provider integration is configured.

Never commit secret values or paste them into chat. The app reads them from the Worker environment at runtime.

## 4. Deployment gate

Before production deployment:

1. Confirm the production GitHub Environment has the four Cloudflare/D1 secrets.
2. Confirm the Cloudflare Worker has GROQ_API_KEY and the Access variables.
3. Confirm the D1 database exists in the same account and the ID matches its name.
4. Review the pending migrations and the generated config.
5. Merge the reviewed branch to main only with explicit approval.
6. Manually run Doot Manual Cloudflare Deploy on main with confirm_deploy=true.

The workflow performs locked install, audit, typecheck, all tests, build, D1 config injection/validation, remote D1 migrations and deployment in that order. A failed migration stops deployment.

No production database was created, no secret was configured and no deployment was triggered as part of this source audit.
