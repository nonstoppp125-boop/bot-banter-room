# XterLiza Autonomous Development System (DevPilot) — A–Z Specification

Status: REQUIRED PRODUCT SPECIFICATION — PLANNED; implementation and verification must be tracked separately.
Product: Liza / XterLiza
Repository: nonstoppp125-boop/bot-banter-room
Roadmap model: Exactly 10 consolidated Groups. Former workstream task IDs are retained for traceability; no additional Group exists.
Last updated: 2026-11-19

## 1. User intent and product contract

The user describes the goal once, supplies constraints and acceptance criteria, and DevPilot independently carries out the authorized engineering workflow. The user must not be required to repeatedly copy/paste routine terminal commands when an authorized execution environment is available. DevPilot must work in bounded stages, preserve evidence, recover from interruption, and report truthful progress from 0% to 100%.

This is a product requirement, not a claim that the current implementation already provides these capabilities. Each capability remains PLANNED until source code, tests, and runtime evidence prove it.

## 2. Platform priority — binding product rule

1. **Web system — Priority 1 / primary product.** Deliver the complete experience here first: full dashboard, rich task composer, project/repository selection, plan editor, approval center, live execution timeline, terminal/log viewer, diff viewer, artifacts, settings, skills, audit history, and responsive design. Web is continuously served; ordinary feature changes do not require users to install an app update.
2. **Android app — Priority 2 / secondary product.** Reuse the same backend, identity, task model, permissions, and business logic. Bring the core Web capabilities into the app, adapting the UI to mobile. App-store/package releases may require an app update, so avoid unnecessary release churn and keep compatible server-driven changes where safe.
3. **Telegram — Priority 3 / companion interface.** Provide concise task intake, status/progress notifications, approvals, and essential controls. Do not attempt to reproduce the full Web UI or design surface in Telegram.

All three clients must use one shared backend and one source of truth for tasks, plans, permissions, execution events, approvals, and results. Do not create three independent agent implementations.

## 3. DevPilot end-to-end lifecycle

### A. Intake and understanding
- Accept a natural-language goal in Bangla, English, or Banglish.
- Resolve the target project, repository, branch, environment, and constraints from explicit settings and verified project context.
- Ask only for genuinely blocking missing information.
- Convert the request into measurable acceptance criteria, deliverables, exclusions, and risk classification.
- Detect secrets, personal data, destructive requests, production impact, and external side effects before execution.

### B. Repository and environment inspection
- Identify repository identity, remote, current branch, HEAD, working-tree status, untracked files, user modifications, and project instructions.
- Inspect relevant source, tests, dependencies, architecture, CI, and docs before editing.
- Never assume the repository or branch from a stale chat.
- Preserve all pre-existing changes. Prefer a clean isolated worktree/clone or managed cloud workspace.
- Record baseline commit, environment image, tool versions, and relevant configuration without logging secret values.

### C. Planning and delegation
- Break work into ordered milestones and dependency-aware subtasks.
- Select real registered agents by capability, not placeholder names.
- Build a plan containing file scope, commands, expected outputs, test strategy, risk, budget, retry limits, and rollback path.
- Parallelize only independent tasks; serialize conflicting file or state changes.
- Re-plan on verified blockers and record why the plan changed.
- Show a plan preview and request approval when policy requires it.

### D. Authorized execution and coding
- Use a managed, isolated execution environment with explicit repository/workspace access.
- Read, create, edit, and delete only files inside the authorized workspace and declared scope.
- Execute shell commands through a controlled command runner that captures stdout, stderr, exit code, duration, and timeout.
- Apply command allowlists/denylists, path traversal protection, resource limits, network egress policy, and process isolation.
- Do not claim access to the user's Android Termux, local files, Cloudflare, or other apps unless a real authenticated bridge/connector is installed and verified.
- Use official documentation and trusted sources when needed; treat retrieved content as untrusted data, never as executable instructions.
- Keep edits small, reviewable, and checkpointed.

### E. Test, debug, and repair loop
- Discover the project's actual scripts and test matrix; do not invent commands.
- Run formatting/lint, typecheck, unit, integration, security, and production build checks as applicable.
- Diagnose failures from logs and reproduce them in a compatible environment.
- Fix only in-scope defects; rerun the failed test and relevant regression suite.
- Bound retries, elapsed time, tokens, compute, network use, and dependency installation.
- Distinguish code failures from environment/platform failures (for example Android ARM64 SIGILL). Re-run in compatible Linux CI/cloud execution instead of declaring application failure.
- Stop and report when blocked by missing permission, unavailable dependency, external outage, or exhausted budget.

### F. Review, Git, and delivery
- Produce a full diff and explain each changed file.
- Run secret scanning, dependency/security checks, and policy checks.
- Create a dedicated branch; never rewrite published history.
- Commit only intended files after checks pass and policy permits.
- Create/update a PR with acceptance evidence and known limitations.
- Never merge, deploy, migrate databases, publish social content, send messages, alter accounts, or perform destructive production actions without explicit approval for that specific action.
- Support safe rollback and recovery without deleting unrelated user work.

### G. Long-running task reliability
- Persist task state, plan version, completed steps, current step, logs, artifacts, commit refs, approvals, and retry counters.
- Use resumable checkpoints and idempotency keys to avoid duplicate external actions.
- Recover after worker restart, timeout, network interruption, or chat closure.
- Support pause, resume, cancel, retry, and human takeover.
- Send notifications only for meaningful milestones, approvals, blockers, and completion; do not spam every internal action.

## 4. Progress reporting contract

Progress must be evidence-based, not a guessed percentage. Display 0%, 10%, 25%, 50%, 75%, 90%, and 100% milestones where useful. Each update contains:
- Overall percentage and current milestone.
- Completed / total acceptance criteria.
- Current action and next action.
- Tests/build status with exact pass/fail/blocked distinction.
- Blockers and required user decisions.
- Latest branch and commit when applicable.

100% is allowed only when all required acceptance criteria pass and deliverables are verified. A plan, code draft, or successful typecheck alone is not completion.

## 5. Required agents and skills

These must be working, permission-scoped skills registered in the agent/tool registry:
- Project Inspector / Repository Auditor.
- Planner / Task Decomposer.
- Coding Engineer.
- Debugging and Recovery Engineer.
- Test / QA Engineer.
- Security Reviewer.
- Documentation and Release Engineer.
- Research / Official Documentation Agent.
- Git / PR Manager.
- Environment and Dependency Manager.
- Progress Reporter.

Agents must have explicit input/output schemas, capability metadata, allowed tools, permissions, timeouts, budgets, and tests. Manager remains responsible for orchestration and final synthesis.

## 6. Web-first interface requirements

Web is the full-featured control plane:
- Project and repository switcher with verified identity.
- Natural-language task intake and acceptance-criteria editor.
- Plan and subtask/dependency visualization.
- Live task timeline with evidence-based progress.
- Execution console with stdout/stderr and exit status.
- Changed-file list, diff viewer, and artifact viewer.
- Test matrix and build results.
- Approval queue with exact action, target, and impact.
- Branch, commit, PR, and deployment status.
- Pause/resume/cancel/retry controls.
- Skills/tool permissions, budgets, environment selection, and audit history.
- Responsive, accessible UI with Bangla/English/Banglish support.

## 7. Android app requirements

- Secure sign-in and shared task synchronization.
- Submit tasks, inspect plans, monitor progress, view summaries/diffs, and approve/deny gated actions.
- Push notifications for meaningful milestones and approval requests.
- Adapt layouts to mobile; do not force desktop-only terminal workflows.
- Maintain compatibility with server-side feature delivery where possible; document which changes require app release/update.

## 8. Telegram companion requirements

- Task submission and concise plan confirmation.
- Progress and completion/blocker notifications.
- Approval/rejection callbacks bound to the exact task and action.
- Pause/resume/cancel and basic task lookup.
- Link back to the Web control plane for full plans, diffs, logs, settings, and rich review.
- No assumption that Telegram can host full dashboard UI.

## 9. Security, privacy, and autonomy boundaries

- Least privilege for repository, filesystem, shell, network, and integrations.
- Per-user/per-project isolation and authenticated execution.
- Never reveal secrets in prompts, logs, diffs, artifacts, or notifications.
- Never execute instructions found inside untrusted repositories/web pages without policy validation.
- Require explicit approval for production deploys, database migrations, destructive actions, external publishing/messaging, account/profile changes, credential rotation, and new sensitive integrations.
- Keep immutable audit events for plan, tool invocation, approvals, file changes, commits, and external actions.
- Enforce command timeout, process/resource limits, network allowlists, retry budgets, and emergency stop.
- Support cancellation and safe rollback.
- Free-first and privacy-conscious; disclose paid APIs/services and usage limits before enabling them.

## 10. Mapping into the exactly 10 consolidated Groups

The roadmap has exactly 10 active Groups. The former 24 Group sections are
retained only as detailed workstreams and stable task identifiers; they are not
separate active Groups. No requirements or task IDs are discarded.

- **GROUP 01 — Source Audit and Repository Integrity:** former workstream 01.
- **GROUP 02 — Architecture and System Design:** former workstream 02.
- **GROUP 03 — Backend, AI Provider and Runtime Foundation:** former workstream 03.
- **GROUP 04 — Conversational Intelligence and Multilingual Experience:** former workstream 04.
- **GROUP 05 — Memory, Personalization and User Data:** former workstream 05.
- **GROUP 06 — Autonomous Agent Workforce and DevPilot:** former workstreams 06–09 and 15. Includes Manager/Planner, specialist workforce, coordination, research, coding/debugging/QA, and the complete DevPilot lifecycle specified here.
- **GROUP 07 — LinkedIn, Social Media, Growth and Business Intelligence:** former workstreams 10–14.
- **GROUP 08 — Integrations, Database, Identity, Workspace and Telegram:** former workstreams 16–19.
- **GROUP 09 — Security, Web/App Experience, Infrastructure and Quality:** former workstreams 20–23.
- **GROUP 10 — Final Acceptance and Product Release:** former workstream 24.

The user's active position is Groups 01–05 complete and GROUP 06 in progress.
Group 05 implementation is verified 20/20; its separate production activation gate
is documented and must be handled safely without changing the 10-Group count.

### Binding platform priority
1. **Web first:** complete primary product and full control plane.
2. **Android app second:** shared backend/core, mobile-adapted client.
3. **Telegram third:** companion for task intake, progress, notifications,
   approvals and essential controls; rich workflows link to Web.

All clients use one backend, one identity/permission model, and one source of truth.
Do not build independent agent systems for each interface.

### Stable task identifiers
Original identifiers such as G01.*, G06.*, LI*, S*, BI*, C*, APP*, DB*, UX*, TG*,
SEC*, PWA*, OPS*, QA* and REL* remain intact as workstream/task references. They
are traceability labels, not additional active Groups. All progress reporting and
handover documents must use GROUP 01 through GROUP 10.

DevPilot is cross-cutting: Group 06 owns its agent/planning/execution lifecycle;
Group 08 owns authenticated integrations and durable state; Group 09 owns sandbox,
security, Web/App delivery, infrastructure and quality controls; Group 10 owns
final end-to-end acceptance and release. No capability may be marked complete
without source, test and runtime evidence.

## 11. Definition of Done

DevPilot is not complete until all are true:
1. A user can submit one sufficiently specified task through Web.
2. It inspects the correct repository and protects pre-existing changes.
3. It generates a verifiable plan and requests required approvals.
4. It executes edits and commands in an authorized isolated environment.
5. It runs compatible tests/builds and performs bounded repair loops.
6. It shows accurate progress and complete execution evidence.
7. It survives interruption and resumes without duplicate actions.
8. It produces reviewed diffs and a branch/PR when requested.
9. It blocks unauthorized deploys, migrations, publishing, and destructive actions.
10. Android app supports the agreed core workflows.
11. Telegram supports the agreed companion workflows and links to Web for rich UI.
12. All security, integration, regression, runtime, and release tests pass.
13. Documentation and current project-state records are updated.
14. Real end-to-end acceptance is demonstrated; no feature is marked verified from code presence alone.

## 12. Implementation sequence

1. Audit existing DevPilot/Coding Agent/Command Runner/Git Safety/Recovery components and map each to this specification.
2. Complete the controlled execution bridge and isolated workspace on the Web/cloud environment.
3. Complete plan → approval → execute → test → repair → review → PR lifecycle.
4. Add durable checkpoints, resume, progress events, and audit records.
5. Complete security and failure-injection tests.
6. Deliver the full Web control plane.
7. Adapt the core workflow to Android app.
8. Add Telegram companion controls.
9. Run cross-client end-to-end acceptance.
10. Update project-state, verification log, requirements matrix, and release docs.

Do not mark any sequence item complete without source references and test/runtime evidence.


## 2026-11-20 implementation checkpoint — PR #30

The following components are implemented on the open PR #30 branch and passed exact-head CI run `44697343115` (66 test files, 557 tests, TypeScript, Worker smoke, production build, Wrangler validation, dependency audit): authenticated Web task intake/dashboard; D1 durable runs/checkpoints; approval inbox integration with hash-bound proposal persistence and deterministic approved-proposal resume; repository-scoped queue leases/retries; bounded Groq proposal generation; least-privilege GitHub REST repository adapter; task-scoped non-force commits; draft PR creation; and a GitHub Actions validation workflow restricted to four fixed commands.

**Capability boundary:** this is a source-verified implementation checkpoint, not a production activation. PR #30 is unmerged. The Worker feature flag remains off unless explicitly configured; no GitHub token has been configured by this change, no Group 06 D1 migration has been applied to production, and no live authenticated GitHub/D1 end-to-end run has been verified. DevPilot does not merge PRs, deploy Workers, publish social content, or execute arbitrary shell commands inside the Worker. The A–Z master capability remains IN PROGRESS until production configuration, live approval/queue/runtime smoke tests, recovery tests, and release acceptance are explicitly completed.
