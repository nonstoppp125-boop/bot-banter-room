# PART 08 — GROUP 07 Specialist Workforce Status

## G07.01–G07.04 — Base contract, registry, capabilities and permissions

IMPLEMENTED AT STATIC / CODE LEVEL.

A reusable BaseAgent contract now defines identity, role, capabilities,
permissions and execution interfaces. AgentDefinition remains as a
backward-compatible alias. All 18 registered agents declare capability
metadata. The registry validates unique normalized IDs, identity metadata, non-empty and
supported capabilities, duplicate capabilities, non-empty and supported
permissions, duplicate permissions, valid roles and role-specific execution
handlers. The runtime map is built from the same validated registry list.

Runtime permissions are explicitly scoped: `llm:inference`, `research:search`,
`research:extract` and `coding:validate-command`. No shell, filesystem,
publishing, messaging or external-account execution permission is granted.
Registry and specialist execution tests have CI runtime evidence.

## G07.21 — Specialist-specific system prompts

IMPLEMENTED for all 17 registered specialists.

Each specialist has a distinct role-specific system prompt in
`src/lib/agents/specialists.ts`, covering Research, Web Intelligence,
Coding, Debugging, Data Analyst, Business Analyst, LinkedIn, Social Media,
Content Writer, Content Reviewer, SEO, Problem Solver, Marketing
Strategist, Quality Reviewer, Security Reviewer, Automation and Reporting.
Prompts define responsibilities, output constraints and relevant safety
limitations.

## G07.22 — Specialist-specific tools

PARTIALLY IMPLEMENTED.

A permission-scoped tool registry is now wired through the orchestrator:
- Research and Web Intelligence may call only the bounded Tavily search and selected-page extraction tools.
- Coding may call only the exact allowlisted validation-command checker; it does not execute commands.
- Tool calls require an explicit per-agent permission and fail closed on missing credentials, invalid arguments or cancellation.
- Other specialists have no tool permissions. No shell, filesystem, publishing, messaging or external-account execution is exposed.

## G07.05–G07.15 — New specialist agents

IMPLEMENTED AT CODE / REGISTRY LEVEL.

Research, Web Intelligence, Coding, Debugging, Data Analyst,
Business Analyst, LinkedIn, Social Media, Content Writer,
Content Reviewer and SEO agents have been implemented and registered.
The registry now contains 17 specialist agents in total.

These are prompt-based specialists. Their presence does not imply
independent tool execution or external account access.

## G07.23 — Agent capability tests

IMPLEMENTED AND RUNTIME-VERIFIED IN CI.

Registry tests verify unique IDs, descriptions, generator availability, malformed
metadata rejection, unsupported/duplicate capabilities and permissions, invalid
roles, and missing role-specific execution handlers.
The capability test invokes every registered specialist and checks for a
non-empty generated result. Static checks pass, but runtime execution has
not been verified in the current Termux environment.

## G07.24 — Specialist failure tests

IMPLEMENTED.

Tests verify provider failures reject specialist generation rather than
fabricating successful output. Existing multi-agent tests also cover
fallback to normal Liza when both active specialists fail.

GitHub Actions runtime verification passed in run `43798972433`; the earlier Termux-specific Vitest crash (exit 132) remains an environment limitation, not a CI failure.

## G07.25 — Never register nonfunctional placeholder agents

IMPLEMENTED.

Registry assertions verify every registered specialist has a generator
and a non-empty description. No placeholder specialist is added.

## Important scope limitations

G07.22 is PARTIALLY IMPLEMENTED: Research/Web Intelligence search and extraction plus Coding command validation are permission-controlled and orchestrator-wired. Other specialist tools and model-directed tool selection remain open. Do not represent prompt-based specialists as agents with unrestricted external tools.

Group 07 is NOT fully complete. G07.01–G07.04 now have static implementation; runtime tests remain unverified because of
the Termux/Vitest illegal-instruction crash. G07.01–G07.04 and G07.16–G07.20
must be assessed against their actual implementation before declaring the
whole group complete.

No commit, push, deployment or external action was performed.


## 2026-11-16 — Group 07 CI verification refresh
- Branch: `work/group06-manager-planner`
- GitHub Actions run `43798972433`: SUCCESS — TypeScript, 16 test files / 175 tests, production build and Nitro-generated Wrangler validation.
- Registry validation and specialist execution tests now have CI runtime evidence.
- G07.22 remains PARTIALLY IMPLEMENTED: the permission-controlled tool layer is implemented for research search/extraction and coding validation. Other specialist tools and model-directed tool selection remain open.
- Termux's previous Vitest exit 132 remains a local runtime limitation; CI verification is independent.


## 2026-11-16 — Permission-scoped specialist tool runtime
- Added explicit `research:search`, `research:extract` and `coding:validate-command` permissions.
- Orchestrator research calls now pass through the specialist tool registry; only Research/Web Intelligence can search or extract.
- Coding can inspect whether a command is an exact allowlisted validation command; no command is executed.
- Added tests for tool listing, cross-agent denial, missing credentials and shell-composition rejection.
- GitHub Actions run `43809939660`: SUCCESS.


## 2026-11-16 — Extraction argument hardening
- Specialist research extraction now validates each untrusted source object at the tool boundary: bounded ID/title/URL/content, required retrieval metadata, optional metadata types, unique source IDs and configured server-side provider credentials.
- Invalid or duplicate metadata is rejected before any provider request.
- Added regression tests for malformed metadata, duplicate IDs and missing extraction credentials.
- GitHub Actions run `43825704479`: SUCCESS — TypeScript, 46 test files / 341 tests, production build and Nitro-generated Wrangler validation.
- G07.22 remains partial: no arbitrary browsing, shell execution or external side effects are exposed.
