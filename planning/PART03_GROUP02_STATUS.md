# PART 03 — GROUP 02: Architecture and System Design

Date: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Baseline commit: `f9521a48e2ed9f6494d6f7b01eeaf4d80cebb10a`

## Group 02 checklist

| Item | Status | Evidence |
|---|---|---|
| G02.01 Frontend architecture | COMPLETE | route tree, root shell, chat page, page routes and component inventory |
| G02.02 Backend/runtime architecture | COMPLETE | TanStack Start/Nitro Worker, API wrappers, typed Worker bindings |
| G02.03 Application routing | COMPLETE | all 27 executable route modules and methods mapped |
| G02.04 Request lifecycle | COMPLETE | chat, task, OAuth and Telegram flows documented |
| G02.05 Provider lifecycle | COMPLETE | Groq required provider, Tavily optional research provider, limits and gaps mapped |
| G02.06 Agent execution lifecycle | COMPLETE | Manager, registry, coordinator, reviewer and synthesis mapped |
| G02.07 Streaming lifecycle | COMPLETE | AI SDK `useChat` → `streamText` → UI message stream |
| G02.08 Error/cancellation lifecycle | COMPLETE | bounded body reads, fail-closed rate limit, AbortSignal, timeouts and status handling |
| G02.09 Agent contracts | COMPLETE | `AgentDefinition`, capabilities, permissions and roles mapped |
| G02.10 Specialist I/O | COMPLETE | message/context inputs, text outputs and usage metadata documented |
| G02.11 Manager/planner architecture | COMPLETE | deterministic routing, constrained LLM decomposition, risk and bounded replan |
| G02.12 Tool execution boundary | COMPLETE | static tool registry and per-agent permission checks mapped |
| G02.13 Integration architecture | COMPLETE | provider catalog, OAuth state/PKCE, encrypted credentials, replay protection |
| G02.14 Memory architecture | COMPLETE | session-bound user/workspace-scoped D1 memory and conversation stores mapped |
| G02.15 Persistence/database architecture | COMPLETE | 15 migrations, logical table groups and missing runtime binding documented |
| G02.16 Human approval architecture | COMPLETE | payload-hash-bound approvals, admin decisions and task unlock verified in source |
| G02.17 Authentication/authorization | COMPLETE | Cloudflare Access JWT, session cookie, workspace roles and Telegram identity boundaries |
| G02.18 Durable task/execution architecture | COMPLETE | D1 task state machine and explicit synchronous execution; no background queue documented |
| G02.19 Observability/operations | COMPLETE | structured log, health/readiness, analytics and operational gaps mapped |
| G02.20 Architecture map and decisions | COMPLETE | current map, lifecycle diagrams, data/security map and target-vs-implemented distinctions published |

## Architecture decisions

1. Keep the target architecture in `DOOT_LIZA_ARCHITECTURE.md`; treat it as a target, not an implementation claim.
2. Use the source-mapped reality in `GROUP02_ARCHITECTURE_MAP.md` as the baseline for Group 03.
3. Keep chat, durable tasks, approvals, OAuth and Telegram as separate request/identity flows; do not assume one universal auth path.
4. Do not introduce background task claims: task execution is explicitly synchronous and user-triggered.
5. Do not enable external side effects while integration definitions remain `liveActionsEnabled: false`.
6. D1 provisioning/binding and migration state must be resolved before production deployment; no database ID or secret is invented.
7. The single Groq provider is the current implementation; multi-provider fallback remains a future capability.

## Runtime verification boundaries

The architecture map is complete at source/configuration level. Actual Cloudflare Access settings, Worker secrets, D1 database provisioning/migration state, provider accounts, OAuth app grants, Telegram webhook registration and production deployment are external runtime acceptance items. Tracked `wrangler.json` currently lacks the D1 `ACTION_DB` binding required by the manual deployment workflow.

**GROUP 02 — COMPLETE (source architecture and system design).** Production architecture is not approved for deployment until the external runtime blockers above are resolved.
