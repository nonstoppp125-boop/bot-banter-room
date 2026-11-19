# PART 16 — GROUP 15 Coding and Technical Workforce Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- C01–C04 — Bounded repository inventory metadata, safe path filtering, exact repository/branch/head SHA and exclusion of secret/vendor/build paths.
- C05 — Risk-aware engineering plan with inspect scope, acceptance criteria and validation commands.
- C06–C07 — Validated code-change proposal creation with stale-SHA, non-main branch, path traversal, file-count and size checks; proposals remain pending review and are not written.
- C08–C09 — Structured diff review flags likely embedded secrets, dynamic execution and unsafe rendering primitives; heuristic only.
- C10 — Test-change signal and acceptance criteria.
- C11–C14 — Exact validation-command allowlist for tests/typecheck/build/lint, production dependency audit and read-only Git status/diff checks; no arbitrary shell executor.
- C15–C16 — Structured review findings and risk codes.
- C17 — Dependency manifest inspection, exact/range version awareness, lockfile and lifecycle-script warnings; actual advisory scan remains command-only until a controlled runner exists.
- C18–C19 — Engineering event log contract with evidence references.
- C21–C23 — Main-branch proposal rejection, sensitive-path filtering, bounded changes and no destructive command support.

## Remaining / blocked
- C11–C14 — No remote shell/container execution is connected; allowlist is a policy contract, not an executor.
- C17 — Live vulnerability findings require running npm audit against current advisories in a controlled environment.
- C20 — No Git commit/push executor; explicit approval and controlled Git integration are required.
- C24–C25 — Durable task logs and end-to-end engineering reports require persistent storage and runtime integration.

GROUP 15: IN PROGRESS — secure inventory, planning, proposal, dependency inspection and review foundations implemented; execution and Git actions remain intentionally disconnected.
No merge to main; no production deployment.
