# XterLiza Autonomous Development System (DevPilot) — A–Z Specification

Status: REQUIRED PRODUCT SPECIFICATION — PLANNED; implementation and verification must be tracked separately.
Product: Liza / XterLiza
Repository: nonstoppp125-boop/bot-banter-room
Roadmap model: Existing 24 Groups only. This document does not create a Group 25.
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

## 10. Mapping into the existing 24 Groups

No new Group is created. DevPilot is a cross-group capability:
- **G06 Manager Agent and Planner:** task intake, decomposition, risk/cost, permissions, delegation, state tracking, replanning, final report.
- **G07 Specialist Agent Workforce:** real coding, debugging, QA, security, research, documentation, and release agents.
- **G08 Multi-Agent Coordination:** dependencies, parallel/sequential execution, handoffs, shared/isolated context, retries, cancellation, aggregation.
- **G09 Research and Web Intelligence:** official documentation research, source verification, citations, untrusted-content protection.
- **G15 Coding and Technical Workforce:** repository inspection, code edits, controlled command execution, tests, diffs, Git workflow, technical reports.
- **G16 External App Connection Hub:** authenticated GitHub and other approved integrations; least privilege and audit.
- **G17 Database and User Workspace:** durable task state, checkpoints, artifacts, approvals, and execution history.
- **G20 Security and Human Control:** sandboxing, command restrictions, approval policy, audit integrity, secret protection, recovery.
- **G21 PWA, Mobile and Accessibility:** implement Web-first control plane, then Android app adaptation; accessibility and multilingual UI.
- **G22 Production Infrastructure:** cloud execution workers, CI/CD, monitoring, health, cost/quota, backup and rollback.
- **G23 Testing and Quality:** unit/integration/E2E/security/runtime tests for every agent, tool, interface, and failure path.
- **G24 Final Product Release:** acceptance evidence, user docs, release, known limitations, post-release improvement.

Groups 01–05 provide the source audit, architecture, provider, conversational intelligence, and memory foundation. DevPilot must not bypass their contracts.

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
