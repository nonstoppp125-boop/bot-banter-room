# Production Environment and Release Checklist

This repository has source-level Cloudflare Worker support, but the production account is not provisioned by CI. Never invent IDs, credentials, provider scopes or account configuration.

## 1. Cloudflare D1

1. Create the production D1 database in the intended Cloudflare account:
   `npx wrangler d1 create doot-liza-prod`.
2. Add the returned real database ID to the root `wrangler.json` as a `d1_databases` binding named `ACTION_DB`, with the matching database name.
3. Apply every checked-in migration in order:
   `npx wrangler d1 migrations apply doot-liza-prod --remote`.
4. Verify the generated `.output/server/wrangler.json` contains the same `ACTION_DB` binding. The deployment workflow fails closed when it is absent.
5. Verify backup and restore in a separate test database before enabling production traffic.

Do not add a placeholder database ID. A placeholder is not provisioning and must not be allowed to pass release validation.

## 2. Cloudflare Access

Configure a Cloudflare Access application for the production hostname and set Worker secrets:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `CF_ACCESS_ALLOWED_EMAIL_DOMAINS` (optional, comma-separated allowlist)

Verify login, logout, session expiry, workspace membership and admin-only approval actions using real test accounts.

## 3. AI and research providers

Configure server-side Worker secrets only:

- `GROQ_API_KEY` (required for AI task execution)
- `GROQ_MODEL` (optional; source default otherwise)
- `TAVILY_API_KEY` (optional; enables live research tools)
- `DOOT_MULTI_AGENT=true` (enable the registered specialist workflow)

Never expose these values through `VITE_*` client variables or commit them to Git.

## 4. OAuth providers

The OAuth storage layer requires:

- `OAUTH_ENCRYPTION_KEY`: base64url encoding of a 32-byte key (43 characters).
- For each provider that has been approved and configured, use the provider prefix in the form `OAUTH_<PROVIDER>_...`, with server-side values for `CLIENT_ID`, `CLIENT_SECRET`, `AUTHORIZATION_ENDPOINT`, `TOKEN_ENDPOINT`, `REDIRECT_URI` and `REGISTERED_REDIRECT_URI`. `CLIENT_AUTH_METHOD` is optional and provider-specific.

Provider scopes must match the permissions actually granted by the provider. Register the exact callback URL. Do not enable a provider merely because its generic OAuth endpoints exist in source.

## 5. Telegram

Configure:

- `TELEGRAM_BOT_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_APPROVAL_CALLBACK_SECRET`

Apply the Telegram migrations, register the production webhook with Telegram's secret-token header, and test private-chat linking, `/task`, `/tasks`, `/approvals`, callback ownership and failure handling. The bot does not run Manager tasks or perform external actions directly.

## 6. GitHub deployment secrets and release gates

Add GitHub Actions environment secrets:

- `CLOUDFLARE_API_TOKEN` with only the required deployment permissions
- `CLOUDFLARE_ACCOUNT_ID`

The manual deploy workflow only proceeds when explicitly confirmed from `main`, after typecheck, all tests, production build and generated Wrangler configuration validation. It also requires a real `ACTION_DB` binding. Do not merge or deploy a work branch as a substitute for release approval.

## 7. Required release evidence

Before declaring production complete, record and verify:

- Remote migrations applied successfully and D1 reads/writes work.
- Cloudflare Access authentication, role checks and session revocation work.
- Provider OAuth consent, callback, encrypted token storage, refresh and disconnect work for each enabled provider.
- Telegram webhook and bot runtime work with real credentials.
- External-action executors are separately implemented, payload-bound to approvals, idempotent and tested against provider sandboxes. Current approval checks do not mean publishing, messaging, deletion, deployment or financial execution is implemented.
- Backups restore successfully; monitoring, alerting and rollback are rehearsed.
- Mobile browser/device checks, privacy review, manual user acceptance and final release sign-off are recorded.

Until these checks have real account-side evidence, the project is source/CI verified only—not production complete.
