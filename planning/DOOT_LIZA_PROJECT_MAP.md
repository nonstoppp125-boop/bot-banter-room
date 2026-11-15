# DOOT / LIZA — MASTER PROJECT MAP

PRODUCT: AI PERSONAL & BUSINESS OPERATING SYSTEM
TOTAL: 7 STAGES | 24 GROUPS
NUMBERING: STAGE.GROUP.STEP.SUBSTEP

## STAGE 1 — FOUNDATION & CORE AI
1.1 Source Audit
1.2 Architecture
1.3 Backend & Provider
1.4 Conversational AI

## STAGE 2 — MEMORY & AGENT WORKFORCE
2.1 Persistent Memory
2.2 Manager & Planner
2.3 Specialist Agents
2.4 Multi-Agent Coordination

## STAGE 3 — RESEARCH & LINKEDIN
3.1 Research Intelligence
3.2 LinkedIn Intelligence
3.3 LinkedIn Content Studio
3.4 LinkedIn Growth

## STAGE 4 — BUSINESS SPECIALIST PRODUCTS
4.1 Multi-Platform Social
4.2 Business Intelligence
4.3 Coding Workforce

## STAGE 5 — INTEGRATIONS & WORKSPACE
5.1 App Integration Hub
5.2 Database & Workspace
5.3 Authentication & Workspace UX

## STAGE 6 — CHANNELS, SECURITY & CLIENTS
6.1 Telegram
6.2 Security & Human Approval
6.3 PWA & Mobile

## STAGE 7 — PRODUCTION & RELEASE
7.1 Production Infrastructure
7.2 Full QA
7.3 Release & Handover

## NUMBERING RULE
Stage: 1
Group: 1.1
Step: 1.1.1
Substep: 1.1.1.1

Every group contains the steps required by its scope.
Every step contains the necessary substeps.
No fixed artificial step count.
No skipping groups or acceptance criteria.

## EXECUTION RULE
Complete one group at a time.
Implement the whole group before consolidated verification.
Fix failures and re-verify before proceeding.
Preserve user changes and existing backups.
Never claim unverified completion.

## CURRENT POSITION
STAGE 1/7
GROUP 1.1/24 — SOURCE AUDIT

1.1.1 Repository and Git identity — COMPLETE
1.1.2 Local/remote history comparison — COMPLETE
1.1.3 Remote source inventory — IN PROGRESS
1.1.4 Dependencies and runtime verification — BLOCKED
1.1.5 Security and deployment audit — PENDING
1.1.6 Audit report and acceptance — PENDING


<!-- LIVE_PROGRESS_START -->
## Live Progress
- Stage 1/7 — Foundation & Core AI
- Group 1.1 — Source Audit: audit closed; runtime blocker documented
- Group 1.2 — Architecture: audit and target blueprint documented
- Group 1.3 — Backend & Provider: AUDIT/DESIGN PHASE COMPLETE
- Steps 1.3.1–1.3.6: source audit, contract design, lifecycle trace,
  API validation audit, runtime audit, consolidated review
- Group 1.3 implementation and runtime verification: PENDING
- Remote main: 13 commits ahead at last recorded comparison; not merged
- Application source: unchanged during Group 1.3 audit
<!-- LIVE_PROGRESS_END -->\n\n
## Group 1.3 implementation update — 2026-11-10
- Hardened chat request validation: non-empty bounded message batches, bounded parts, valid IDs/roles/parts, and rejection of client-supplied system/developer roles.
- Removed unsafe non-null handler/generator assertions from orchestration dispatch.
- Added defensive specialist dispatch, abort checks, safe default-agent fallback, and generic server error responses that do not expose provider internals.
- Added regression tests for malformed messages, unsafe roles, empty batches, oversized batches, and malformed JSON.
- Verification status is recorded below only after the commands complete; no test/build result is assumed.
