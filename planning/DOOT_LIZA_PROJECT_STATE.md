# Doot / Liza — Project State

Last handover baseline: 2026-11-10.
Repository: nonstoppp125-boop/bot-banter-room
Default branch: main
Reported latest verified commit: 3f0b138105ab3781e920b8853c41ae0d188735ec

## 2026-11-13 batch update

- Groups 08–09: partial implementation; see `GROUP_08_10_BATCH_STATUS.md`.
- Group 10 LI01: feasibility audit documented.
- LinkedIn OAuth/account access is not implemented.
- Durable action storage is not configured; external actions remain fail-closed.
- Runtime Vitest/build verification remains environment-blocked in Termux.
- No commit, push or deployment is recorded by this update.

## Workflow

Step 2/7 — Project Audit.
Previously reported substeps 2.1–2.5 complete; evidence still needs consolidation.
Next: finish local inventory, compare local clone with remote main, inspect deployment/configuration and tests, write audit report. Then Step 3 implementation plan.

## Planning status

- DOOT_LIZA_MASTER_ROADMAP.md: created and checksum-verified.
- Supporting architecture/state/rules/log/matrices: being established.
- Source implementation: no changes authorized by this documentation task.
- Existing backups must remain untouched.

## Known baseline facts — not yet independently reverified

- React 19, TypeScript 5.8+, TanStack Start/Router, Vite 8, Nitro, Tailwind CSS 4.
- Vercel AI SDK 7; Groq OpenAI-compatible provider; model reported as openai/gpt-oss-20b.
- Chat UI: src/routes/index.tsx; API: src/routes/api/chat.ts.
- Orchestrator: src/lib/agents/orchestrator.ts.
- Agents reported: liza-default, problem-solver, quality-reviewer.
- Multi-agent flag: DOOT_MULTI_AGENT === "true".
- Cloudflare Worker deployment and health remain unverified.
- Authentication, durable persistence, attachment processing and Telegram integration require audit.
- Do not claim tests passed until actually executed and recorded.

## 2026-11-13 routing update

- Multi-capability router implementation and regression test added.
- Static verification pending.
- Runtime test status remains blocked/unverified; no test pass is claimed.
