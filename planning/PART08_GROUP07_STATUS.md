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

Current permission model is deliberately restricted to `llm:inference`.
No shell, filesystem, publishing, messaging, browsing or external-account
permissions are granted. Runtime validation remains unverified until Vitest
can execute successfully.

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

BLOCKED.

The inspected source contains no actual tool integrations or tool execution
framework. No fake tools or unsupported capabilities are registered.
This requires a separately designed, permission-controlled tool layer.

## G07.05–G07.15 — New specialist agents

IMPLEMENTED AT CODE / REGISTRY LEVEL.

Research, Web Intelligence, Coding, Debugging, Data Analyst,
Business Analyst, LinkedIn, Social Media, Content Writer,
Content Reviewer and SEO agents have been implemented and registered.
The registry now contains 17 specialist agents in total.

These are prompt-based specialists. Their presence does not imply
independent tool execution or external account access.

## G07.23 — Agent capability tests

IMPLEMENTED AT TEST-CODE LEVEL; RUNTIME UNVERIFIED.

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

Runtime execution remains unverified: Vitest terminates with
`Illegal instruction` (exit 132) in the current Termux Node environment.

## G07.25 — Never register nonfunctional placeholder agents

IMPLEMENTED.

Registry assertions verify every registered specialist has a generator
and a non-empty description. No placeholder specialist is added.

## Important scope limitations

G07.22 remains BLOCKED because no real specialist-specific tool integration
or permission-controlled execution framework exists. Do not represent
prompt-based specialists as agents with working external tools.

Group 07 is NOT fully complete. G07.01–G07.04 now have static implementation; runtime tests remain unverified because of
the Termux/Vitest illegal-instruction crash. G07.01–G07.04 and G07.16–G07.20
must be assessed against their actual implementation before declaring the
whole group complete.

No commit, push, deployment or external action was performed.
