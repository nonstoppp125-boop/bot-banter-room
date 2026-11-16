# Group 03 — Backend and Provider Status

Snapshot: 2026-11-16  
Repository: nonstoppp125-boop/bot-banter-room  
Branch: work/group06-manager-planner  
Baseline commit: e2cc5a4eb01d427d6f8e27bdb0a6f34219541fdf

## Task status

| Task | Status | Evidence |
|---|---|---|
| G03.01 Stable chat API | COMPLETE | POST /api/chat, AI SDK UI-message stream |
| G03.02 Worker environment access | COMPLETE | typed request-runtime Cloudflare env access |
| G03.03 Groq key configuration | COMPLETE | required server-side GROQ_API_KEY; fail closed |
| G03.04 Environment template | COMPLETE | names/placeholders only; no values committed |
| G03.05 Multi-agent toggle | COMPLETE | exact DOOT_MULTI_AGENT === "true" |
| G03.06–G03.09 Input validation and safe errors | COMPLETE | UIMessage validation, role restrictions, bounded JSON, generic errors |
| G03.10–G03.12 Provider timeouts/retry/cancel | COMPLETE | 45s total, 20s first chunk, 15s chunk; one retry; AbortSignal |
| G03.13 Worker streaming | COMPLETE — LOCAL WORKERD | pinned Wrangler 4.162.0 smoke test verifies AI SDK UI stream delivery in local workerd |
| G03.14–G03.15 Rate limit/abuse controls | COMPLETE | 30/60s Worker limiter, 1 MiB request cap, message/part/text limits, fail closed |
| G03.16 Quota monitoring | COMPLETE — RESPONSE LEVEL | sanitized Groq rate-limit header and 429 telemetry; no prompt/body/key logging |
| G03.17 Model configuration | COMPLETE | trusted GROQ_MODEL override, default openai/gpt-oss-20b, pricing table |
| G03.18 Alternative provider evaluation | COMPLETE | Groq, Workers AI, Gemini and OpenRouter compared |
| G03.19 Failure/fallback policy | COMPLETE | bounded retry, timeout, cancellation, generic errors; no silent cross-provider fallback |
| G03.20 Production binding/deployment | BLOCKED — EXTERNAL CONFIG + APPROVAL | workflow now injects ACTION_DB and applies migrations, but real D1 ID/name, Cloudflare credentials, Worker secret and main-branch deployment authorization are not available in this branch |

## Changes implemented

- src/lib/agents/groq.ts: wraps provider fetch and emits sanitized groq.rate_limit events from quota headers and HTTP 429.
- src/test/groq-provider.test.ts: five quota telemetry tests.
- src/test/fixtures/worker-streaming.ts, wrangler.stream-test.json, scripts/test-worker-streaming.sh: local workerd UI-stream smoke test.
- scripts/configure-production-d1.mjs: validates D1 database name/UUID, injects ACTION_DB, computes migrations path relative to generated Wrangler config, and declares GROQ_API_KEY as a required Worker secret.
- src/test/production-deploy-config.test.ts: four deployment-config tests.
- .github/workflows/deploy.yml: manual main-only workflow now requires D1 identity, validates generated binding/migrations, applies pending remote D1 migrations, then deploys with pinned Wrangler 4.162.0.

## Latest successful CI

Run: https://github.com/nonstoppp125-boop/bot-banter-room/actions/runs/43894029439  
Commit: e2cc5a4eb01d427d6f8e27bdb0a6f34219541fdf  
- 55 test files / 419 tests passed.
- TypeScript passed.
- Local workerd streaming smoke test passed.
- Production build passed.
- Generated Wrangler configuration validation passed.
- Static dependency report and configured production dependency audit passed.

## Updated external configuration checkpoint — 2026-11-16

User-confirmed setup completed after the original snapshot:
- Cloudflare D1 database `doot-production-db` exists; database UUID was entered into GitHub Environment secrets.
- GitHub Environment `production` contains all four required secret names: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_NAME`, and `CLOUDFLARE_D1_DATABASE_ID`. Values are intentionally not read or logged.
- Cloudflare Worker `bot-banter-room` has the `GROQ_API_KEY` runtime secret; dashboard reported it as encrypted and the dashboard deployment as Ready.

This clears the previously recorded missing-secret/D1-provisioning prerequisite at the account-setup level. It does **not** prove that the GitHub Actions runner can authenticate, that remote migrations apply successfully, that the generated config deploys, or that the live Worker passes smoke tests.

The current feature branch is `work/group06-manager-planner`; the production workflow is intentionally gated to `main` and `confirm_deploy=true`. The current `main` branch does not contain this deployment workflow or the production D1 configuration helper. Therefore a Group-03-only release integration into `main` must be prepared and reviewed before the workflow can run. No merge, remote migration, or production deployment has been performed.

## Remaining external prerequisites

The production deploy workflow uses the GitHub Environment named production. It requires these environment secrets:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_D1_DATABASE_NAME
- CLOUDFLARE_D1_DATABASE_ID

The Worker must also have the GROQ_API_KEY secret configured in Cloudflare. The deployment helper declares it required, so Wrangler refuses deployment if it is absent. Cloudflare Access variables CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be configured for browser sessions; CF_ACCESS_ALLOWED_EMAIL_DOMAINS should be set to the intended allowlist. Telegram and OAuth credentials are optional until those integrations are enabled.

The deployment workflow is restricted to main and requires confirm_deploy=true. The current branch is not main; no merge or deployment was performed. The D1 database must exist in the same Cloudflare account before its actual name/UUID can be entered.

**GROUP 03 STATUS: 19/20 COMPLETE — BLOCKED at G03.20. Do not start Group 04 until the production D1/account configuration is available and deployment is explicitly authorized.**
