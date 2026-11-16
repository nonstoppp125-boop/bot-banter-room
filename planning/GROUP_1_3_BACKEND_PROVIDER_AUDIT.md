# Group 03 — Backend and Provider Source Audit

Snapshot: 2026-11-16  
Branch: `work/group06-manager-planner`  
Baseline: `50d9bcbe8c605f16cf8f9c23ad2bbc8b1c08c88b`

## Backend request path

- `src/routes/api/chat.ts` delegates to `handleChatRequest` in `src/lib/agents/orchestrator.ts`.
- Environment is read from the TanStack/Nitro request runtime; no provider key is sent to the browser.
- `POST /api/chat` requires the Worker rate-limit binding and Groq API key; absent rate limiting fails closed with 503 and an over-limit request returns 429 with Retry-After.
- Request body is streamed/bounded to 1 MiB before JSON validation.
- UIMessage roles are restricted to user/assistant; parts, text size and aggregate text are capped.
- `DOOT_MULTI_AGENT` is opt-in only when its value is exactly `"true"`.
- `GROQ_MODEL` is a trusted server-side model override; default is `openai/gpt-oss-20b`.
- `TAVILY_API_KEY` is optional and only enables research search/extract; it is not an LLM fallback.

## Provider adapter

- `src/lib/agents/groq.ts` creates an OpenAI-compatible Groq Responses model.
- Provider request policy: maxRetries 1; total timeout 45 seconds; first chunk 20 seconds; chunk timeout 15 seconds.
- The request AbortSignal is propagated to model generation/streaming.
- Safe errors are returned to clients; internal provider error content is not surfaced.
- The provider fetch wrapper now emits sanitized rate-limit telemetry from Groq headers and 429 responses.

## Rate-limit and abuse controls

- Cloudflare `CHAT_RATE_LIMITER` is configured for 30 requests per 60 seconds.
- Missing limiter or missing trusted `cf-connecting-ip` returns 503; limiter failure does not silently bypass the control.
- Body cap 1 MiB; at most 100 messages; 200 parts/message; 20,000 characters/text part; 100,000 aggregate text characters.
- Stateful APIs enforce same-origin checks, session and workspace membership.
- Chat itself is not globally session-gated; active session is used only for optional memory context.

## Verification

Latest successful CI: [43892965506](https://github.com/nonstoppp125-boop/bot-banter-room/actions/runs/43892965506).  
- 54 test files / 415 tests passed.
- TypeScript passed.
- Local workerd AI SDK UI-stream smoke test passed.
- Production build and generated Wrangler configuration validation passed.
- Static dependency report artifact and configured production dependency audit passed.

## Remaining external blockers

- Local workerd UI-stream smoke test passes; no deployed production Worker streaming test with real Groq credentials.
- Per-response quota headers and usage estimates are implemented; no account-level dashboard or durable usage ledger.
- No D1 `ACTION_DB` binding/database ID in tracked `wrangler.json`; production deploy workflow requires it.
- Cloudflare account secrets, D1 provisioning/migrations and production deployment remain unverified.
