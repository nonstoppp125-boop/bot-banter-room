# Group 03 — Backend and Provider Decisions

Snapshot: 2026-11-16  
Branch: `work/group06-manager-planner`  
Source baseline: `50d9bcbe8c605f16cf8f9c23ad2bbc8b1c08c88b`

## Task status

| Task | Status | Evidence / decision |
|---|---|---|
| G03.01 Stable chat API | COMPLETE | `POST /api/chat`, AI SDK UI-message stream contract |
| G03.02 Worker environment access | COMPLETE | typed `request.runtime.cloudflare.env` access; secrets remain server-side |
| G03.03 Groq key configuration | COMPLETE | `GROQ_API_KEY` required; missing key fails closed |
| G03.04 Environment template | COMPLETE | `.env.example` contains names/placeholders only |
| G03.05 Multi-agent toggle | COMPLETE | `DOOT_MULTI_AGENT === "true"` enables multi-agent path |
| G03.06 Message schema validation | COMPLETE | role/part validation; client system/developer messages rejected |
| G03.07 Message structure handling | COMPLETE | AI SDK UIMessage and text parts validated |
| G03.08 Request limits | COMPLETE | 1 MiB body; 100 messages; 200 parts/message; 20,000 chars/text; 100,000 aggregate chars |
| G03.09 Safe API errors | COMPLETE | bounded generic client errors; provider details/credentials are not returned |
| G03.10 Provider timeouts | COMPLETE | total 45 s, first chunk 20 s, subsequent chunk 15 s |
| G03.11 Bounded retry | COMPLETE | AI SDK `maxRetries: 1`; no unbounded retry |
| G03.12 Cancellation | COMPLETE | request AbortSignal propagated to provider and coordinator |
| G03.13 Worker streaming test | COMPLETE — LOCAL WORKERD | CI runs a pinned Wrangler local workerd smoke test and verifies AI SDK UI-message event-stream delivery. It is not a deployed production Worker or live Groq request. |
| G03.14 Rate limiting | COMPLETE | Cloudflare binding; 30 requests / 60 seconds; missing binding fails closed with 503; limit returns 429 |
| G03.15 Abuse protection | COMPLETE | body/message caps, strict roles, rate limit, same-origin/CSRF checks on stateful APIs |
| G03.16 Provider quota monitoring | COMPLETE — RESPONSE LEVEL | Groq response headers and 429 Retry-After are logged as sanitized structured events; five focused tests |
| G03.17 Model configuration | COMPLETE | trusted `GROQ_MODEL` override; default `openai/gpt-oss-20b`; model pricing table |
| G03.18 Alternative provider evaluation | COMPLETE | Groq, Cloudflare Workers AI, Gemini API and OpenRouter compared; see `GROUP03_PROVIDER_EVALUATION.md` |
| G03.19 Failure/fallback policy | COMPLETE | one bounded retry, abort/timeout, generic safe error; no silent cross-provider failover |
| G03.20 Production binding/deployment test | **BLOCKED — EXTERNAL** | tracked `wrangler.json` has no `ACTION_DB` D1 binding/database ID; deploy workflow requires it plus Cloudflare credentials and a main-branch manual confirmation |

## Current provider decision

- Keep Groq as the sole production LLM provider for now.
- Keep Tavily as an optional research tool provider, not an LLM fallback.
- Do not silently fail over to Gemini or OpenRouter: their free-tier data handling and upstream routing policies differ.
- Cloudflare Workers AI is the preferred future alternative to benchmark because it is native to the current hosting platform, but it still requires an `AI` binding, model/quality evaluation and explicit privacy review.
- Quota telemetry is request-level and best-effort. It does not create an account-wide dashboard or replace the provider console.

## CI evidence

Successful run: [43892965506](https://github.com/nonstoppp125-boop/bot-banter-room/actions/runs/43892965506)  
Commit: `50d9bcbe8c605f16cf8f9c23ad2bbc8b1c08c88b`  
Results: TypeScript passed; 54 test files / 415 tests passed; local workerd streaming smoke test passed; production build and generated Wrangler config validation passed; static dependency report and configured production audit passed.

## Group decision

**19/20 tasks complete. Group 03 remains BLOCKED by G03.20. Do not start Group 04 until the real D1 binding is provisioned, migrations are applied, required secrets are configured in GitHub/Cloudflare, and the manual deployment validation is explicitly authorized.**
