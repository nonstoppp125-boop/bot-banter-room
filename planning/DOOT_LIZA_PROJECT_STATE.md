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


## 2026-11-16 — Group 06 Manager planning batch

- Added a deterministic Manager planning contract and integrated it into multi-agent routing on `work/group06-manager-planner`.
- Risk classification, explicit approval flags, specialist permission filtering and bounded fan-out are implemented; full autonomous decomposition and replanning remain pending.
- See `planning/PART06_GROUP06_STATUS.md` for exact task scope and limitations.
- GitHub Actions run `43793367110` passed: TypeScript, 156 tests across 14 files, production build and generated Wrangler configuration validation.
- Group 06 remains IN PROGRESS; no merge to `main` and no production deployment.


## 2026-11-16 — Group 06 dependency-aware verification

- Working branch: `work/group06-manager-planner` (isolated remote branch; local Termux branch unchanged).
- Latest verified commit: `d2907df00fa772296538068a785564a567b1f249`.
- GitHub Actions run `43796215581`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler configuration validation.
- Manager planner now includes deterministic dependency ordering and downstream evidence handoff; this is not yet an LLM-based autonomous planner.
- Group 06 remains IN PROGRESS; no merge to `main` and no production deployment.


## 2026-11-16 — Group 06 LLM planner and timeout hardening
- Working branch: `work/group06-manager-planner`; local Termux branch unchanged.
- Latest code commit: `41d897a1481e8ff313eed74e3b8ec69cae5deb9e`.
- Latest verified commit remains `d2907df00fa772296538068a785564a567b1f249`; CI run `43796777895` for current code is pending and has no jobs started.
- Added schema-validated LLM-assisted decomposition for complex tasks, deterministic fallback, dependency preservation, and a 700-token planner output cap.
- Fixed specialist timeout propagation so the per-task AbortSignal reaches the provider request.
- Group 06 remains partial: pricing-based cost estimate, durable state, bounded replanning, enforced approval workflow, deliverable verification and final task report remain.
- No merge to main and no production deployment.


## 2026-11-16 — Group 06 LLM planner, retry and CI verification
- Working branch: `work/group06-manager-planner`; local Termux branch unchanged.
- Verified commit: `1e9a26599a9d80e2ca6389ba6f93e33903b73988`.
- GitHub Actions run `43797011346`: SUCCESS — TypeScript, 14 test files / 163 tests, production build and Nitro-generated Wrangler configuration validation.
- Added schema-validated LLM decomposition for complex work, deterministic fallback, dependency preservation, 700-token planner output cap, task-specific cancellation propagation, and one bounded specialist retry.
- Final synthesis now receives execution outcomes and limitations.
- Group 06 remains partial: pricing-based cost estimate, durable state, revised-plan replanning, enforced approval workflow and formal deliverable acceptance remain.
- No merge to main and no production deployment.


## 2026-11-16 — Group 06 bounded replanning implementation
- Added one bounded deterministic recovery pass for rejected specialist tasks.
- Replacement must be a different registered specialist with overlapping capability and `llm:inference` permission; replacements are never recursively replanned.
- Skipped descendants and tasks with unsuccessful prerequisites are not replanned.
- Replacement execution is included in quality-review evidence and final execution metrics.
- CI verification pending.


## 2026-11-16 — Group 06 bounded replanning verification
- Branch: `work/group06-manager-planner`
- Verified commit: `96c59671077502ba449334cedfc814f269c7dc09`.
- GitHub Actions run `43797912343`: SUCCESS — TypeScript, 14 test files / 167 tests, production build and Nitro-generated Wrangler configuration validation.
- G06.15 implemented as one bounded deterministic replacement pass; replacement eligibility is restricted by registry, capability overlap and inference permission.
- Skipped descendants are not replanned; replan results are included in review evidence and final execution metrics.
- Group 06 remains IN PROGRESS. No merge to `main`; no production deployment.


## 2026-11-16 — Group 06 deliverable acceptance verification
- Added per-subtask, evidence-integrity and conditional approval-safety acceptance criteria.
- Independent reviewer must return a complete structured assessment; malformed output, omitted/duplicate criteria, unknown decisions or inadequate evidence fail closed to `needs-review`.
- Final synthesis is instructed not to claim acceptance unless the acceptance result is `accepted`.
- Verified commit: `e43c2885e6a2251583bac5c7030071c045fe8407`; GitHub Actions run `43798378327` SUCCESS — TypeScript, 15 test files / 172 tests, production build and Wrangler validation.
- Group 06 remains IN PROGRESS; no merge to `main`, no production deployment.


## 2026-11-16 — Group 06 execution cost estimation
- Added specialist generation usage reporting and aggregation for provider-reported input/output tokens; missing usage falls back to explicitly estimated character-based tokens.
- Added Groq published per-token pricing for GPT OSS 20B and 120B; unknown model IDs return no estimate rather than using invented rates.
- Final streamed synthesis uses an explicit 800-output-token allowance and character-based input estimate, so total cost remains an estimate rather than an invoice-equivalent amount.
- Verified commit: `fd7dafb684783ed9a46c6a1da2fa36516636485c`; GitHub Actions run `43798972433` SUCCESS — TypeScript, 16 test files / 175 tests, production build and Wrangler validation.
- G06.08 implementation is complete with documented estimation limitations; G06.13 and G06.18 remain blocked on durable infrastructure and approval persistence.


## 2026-11-16 — Group 06 usage-based cost estimate verified
- Branch: `work/group06-manager-planner`
- Code commit: `fd7dafb684783ed9a46c6a1da2fa36516636485c`; CI `43798972433` SUCCESS.
- Documentation commit: `c1b0cbb61708ecd2f3a9965ca2db83c6b08c5e2a`; CI `43799105011` SUCCESS.
- CI: TypeScript PASS; 16 test files / 175 tests PASS; production build PASS; Nitro Wrangler validation PASS.
- Cost estimate uses provider-reported specialist/planner token usage, character-based fallback for missing usage, published Groq rates for supported model IDs, and an explicit estimate for final streaming synthesis.
- G06.08 complete with stated estimate limitations. G06.13 durable task persistence and G06.18 persisted human approval remain infrastructure-dependent.


## 2026-11-16 — CI verification refresh
- GitHub Actions run `43798972433`: SUCCESS — 16 test files / 175 tests, TypeScript, production build and Nitro-generated Wrangler validation.
- Group 07 registry/specialist runtime tests are verified in CI; G07.22 tool integration remains blocked.
- Group 08 coordination primitives are substantially implemented; durable external-action idempotency remains unconfigured.
- Group 09 research primitives are partially implemented; semantic claim verification/full-page inspection remain open.
- Group 10 remains offline LinkedIn intelligence; OAuth/account access is not claimed.


## 2026-11-16 — Group 08/09 progress
- Group 08 coordination primitives are implemented and CI-verified; durable external-action idempotency remains partial until D1 provisioning and an approved executor.
- Group 09 now includes selected-page extraction through Tavily Extract in addition to search; source content is retained as untrusted evidence and extraction failures preserve search snippets.
- CI run `43799513815`: SUCCESS — TypeScript, 16 test files / 178 tests, production build and Wrangler validation.
- Semantic claim verification remains an explicit limitation.


## 2026-11-16 — Group 10 LinkedIn intelligence
- Offline profile, positioning, audience, market-evidence, brand consistency, performance and dashboard primitives are implemented.
- Official LinkedIn OAuth/account access remains blocked pending developer application approval, actual product scopes, callback configuration and encrypted durable storage.
- CI run `43799513815`: SUCCESS — TypeScript, 16 test files / 178 tests, production build and Wrangler validation.


## 2026-11-16 — Group 11 LinkedIn Content Studio
- Added detailed task mapping in `PART12_GROUP11_STATUS.md`.
- Strategy, calendars, draft formats, language metadata, content review, variants and in-memory version history are implemented.
- Persistent storage and interactive studio UI remain open; no publishing or account access is claimed.
- CI run `43799513815`: SUCCESS — 16 test files / 178 tests, TypeScript, production build and Wrangler validation.
