# Group 03 — Provider Decision Record

Date: 2026-11-16  
Source baseline: e2cc5a4eb01d427d6f8e27bdb0a6f34219541fdf

## Decision

1. **Groq remains the only production LLM provider.** It is already integrated through the OpenAI-compatible Responses API, with server-side API key, bounded timeouts/retries and request-level quota telemetry.
2. **Tavily remains an optional research tool provider**, not an LLM fallback.
3. **No silent cross-provider fallback.** Free-tier providers have different data-retention, training, quota and upstream-routing policies. A fallback must be an explicit user-approved provider policy.
4. **Cloudflare Workers AI is the first future candidate to benchmark** because it shares the hosting account/runtime. It still requires an AI binding, model-quality/latency/cost evaluation and explicit data-policy review.
5. **Do not route private workspace prompts to Gemini free tier or OpenRouter free routing by default.** Their free-tier data handling or upstream provider selection requires additional review.
6. **Quota monitoring is implemented at response level** using Groq rate-limit headers and 429 Retry-After. This is not an account-wide dashboard or durable usage ledger.
7. **Deployment remains manual and gated.** The production workflow now injects the D1 binding from environment secrets, validates the migration directory, applies remote migrations and deploys only from main after explicit confirmation.

## Evidence

- Provider evaluation and source links: GROUP03_PROVIDER_EVALUATION.md.
- Provider lifecycle and quota telemetry: GROUP03_PROVIDER_LIFECYCLE.md.
- Backend request/config audit: GROUP_1_3_BACKEND_PROVIDER_AUDIT.md.
- Production D1 configuration helper and tests: scripts/configure-production-d1.mjs, src/test/production-deploy-config.test.ts.
- CI: https://github.com/nonstoppp125-boop/bot-banter-room/actions/runs/43894029439, 55 files / 419 tests.

## Decision boundary

The source implementation and local workerd stream test are verified. A live Groq request from a deployed Worker, account-specific quota dashboard, Cloudflare D1 provisioning/migration state and production deployment are not verified. No provider credentials were added and no deployment was triggered.
