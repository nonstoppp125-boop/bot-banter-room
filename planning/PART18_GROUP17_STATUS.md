# PART 18 — GROUP 17 Database and User Workspace Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- DB01–DB02 — D1 selected as target persistence adapter; no database ID or production binding invented.
- DB03–DB16 — Normalized schema for users, workspaces, memberships, projects, hashed sessions, conversations, messages, memories, agent tasks, approvals, app connections, social accounts, content drafts, publications, analytics, webhook/OAuth state and audit events; foreign keys, checks and indexes included.
- DB17 and DB24 — Workspace membership access store scopes lookups by workspace and user; role hierarchy enforces member/admin/owner.
- DB18 — Workspace record validation and database constraints.
- DB21 — Bounded retention policy metadata.
- DB22–DB23 — User data export filters by owner/workspace and redacts credentials; explicit same-user deletion request is persisted in D1 with cancellation, due-list and completion-state operations plus a 7–90 day grace period.
- DB23 — Deletion plan revokes sessions, clears encrypted provider credentials, anonymizes audit actor and deletes user; plan is non-executable until approved runtime workflow exists.

## Remaining / blocked
- DB02 — Final database provisioning, cost/limits review and environment binding remain unverified.
- DB16 — Migrations must be applied to provisioned D1 and tested remotely.
- DB19–DB20 — Backups and restoration tests require an actual database.
- DB22–DB23 — Export API, deletion request persistence/cancellation, due-time worker and cascade review remain open.
- DB25 — Concurrent transaction/isolation tests require D1 runtime.

GROUP 17: IN PROGRESS — schema, access, export and deletion policy foundations implemented; live persistence and recovery remain unverified.
No merge to main; no production deployment.
