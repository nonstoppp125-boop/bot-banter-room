# PART 05 — GROUP 05: Memory and Personalization

**Implementation status: VERIFIED (20/20) — 2026-11-17**  
**Production activation: PENDING controlled D1 migration and release**

## Scope and behavior

- Conversation history and durable memory remain separate. Durable memory is loaded only from an authenticated session and the active workspace.
- The Group 05-scoped `migrations/group05/0005_memory_foundation.sql` migration creates only the identity, workspace-membership, session and durable-memory tables required for this group. It stores user-authored entries with category, source, timestamps, optional expiry, and soft deletion.
- Chat extraction stores only a direct English, Bengali-script, or Banglish remember command. Ordinary chat is not promoted to durable memory.
- Extraction classifies preference, project, workflow, and other entries. Bengali project terms and case-insensitive English preference terms are covered.
- The D1 store enforces user + workspace scope and live membership on writes, reads, edits, expiry cleanup, and deletion.
- Retrieval ranks lexical relevance. Only broad response preferences (language/script/tone/format/conciseness) are globally relevant; unrelated preferences such as food preferences are not injected into unrelated tasks.
- Saved memory is labelled untrusted reference data. Embedded instructions are ignored. Conflicting memories are not silently reconciled: Liza must ask the user which fact is current.
- Users can inspect, add, edit, and delete memories at `/settings/memory`, reachable from the chat navigation. Edits use optimistic concurrency; deletes are soft deletes.
- Optional retention dates are user-controlled, bounded to a future date within ten years, and expired entries are lazily soft-deleted before list/search.
- Secret filtering rejects labelled credentials, bearer tokens, private-key headers, and common GitHub, Slack, and AWS token forms.

## G05 acceptance map

| Requirement | Implementation evidence |
|---|---|
| G05.01–02 Context separation and data model | Authenticated session/workspace memory store; existing D1 schema |
| G05.03–04 Explicit preferences and project facts | Multilingual explicit extraction; category classification |
| G05.05–06 Retrieval and ranking | Bounded D1 retrieval with lexical relevance scoring |
| G05.07 Isolation | User/workspace membership predicates; unrelated preference regression test |
| G05.08 Conflicts | Explicit prompt policy asks user to resolve conflicts; no silent overwrite |
| G05.09 Updates | User edit API with expectedUpdatedAt optimistic concurrency |
| G05.10–13 User control, inspection, correction, deletion | Authenticated CRUD API and Memory settings UI |
| G05.14 Retention | Optional expiry date, 10-year bound, lazy expiry cleanup |
| G05.15 Sensitive data | Credential/token/private-key rejection in extractor and store |
| G05.16 Access control | Active Cloudflare Access session, workspace membership, same-origin writes |
| G05.17–19 Cross-session, isolation, retrieval tests | Chat memory, store, API, and extraction test suites |
| G05.20 Limitations | Documented below |

## Verification

GitHub Actions run **44082878485**, exact commit `303f5159ed88258b9c81462f0c467fde71cc256e`:

- 56 test files passed; 434 tests passed
- TypeScript passed
- Production dependency audit: 0 vulnerabilities
- Cloudflare Worker streaming runtime smoke test passed
- Production build passed
- Generated Wrangler configuration validation passed

The Cloudflare automatic Workers Builds check for this feature-branch commit reported failure. No feature-branch deployment was attempted. The independently deployed production Worker remains the Group 03 `main` release.

## Production activation gate and limitations

The production D1 binding exists, but Group 03 intentionally did not apply the migration set because it contains schemas owned by later groups. The isolated Group 05 migration is `migrations/group05/0005_memory_foundation.sql`; the manual deployment workflow now scopes `ACTION_DB` to `migrations/group05`. CI verifies this configuration and the migration's five-table allowlist. Group 05 is not production-active until a clean Group 04/05-only release is prepared, the isolated migration is applied to production, and authenticated live CRUD/chat smoke tests pass.

Memory retrieval is bounded and heuristic, not semantic search. Conflict detection is conservative: Liza asks the user to resolve contradictions rather than guessing. Expiry cleanup is lazy on memory list/search; this is not a scheduled database-wide purge. Users must not save secrets or highly sensitive information.

**GROUP 05 IMPLEMENTATION: COMPLETE (20/20).**  
**Roadmap remains on Group 05 until the production D1 migration/release gate is resolved.** The current feature branch contains later-group baseline code; no later-group implementation work is being advanced as part of this checkpoint.

## 2026-11-17 — Group-scoped migration isolation

- Added `migrations/group05/0005_memory_foundation.sql` containing only the minimum identity, workspace membership, session and memory tables required by Group 05.
- Explicitly excluded Manager task/approval, OAuth, Telegram, social publishing, analytics and audit schemas from this Group 05 migration.
- Updated `configure-production-d1.mjs` to accept a repository-contained `CLOUDFLARE_D1_MIGRATIONS_DIR`; absolute paths and path traversal are rejected.
- Updated the manual deploy workflow to select only `migrations/group05`, rather than the repository-wide migration directory.
- Added regression tests for migration-directory scoping, path traversal rejection and the exact Group 05 table allowlist.
- This is a release-safety change only. It has not been applied to the remote D1 database and no production deployment has been triggered.
- Latest CI run `44082878485` on `303f5159ed88258b9c81462f0c467fde71cc256e` passed: 56 test files / 434 tests, TypeScript, production dependency audit, Worker streaming smoke test, production build and generated Wrangler config validation.
- The current branch still contains later-group source. It must not be merged or deployed wholesale; a clean Group 04/05-only release artifact and authenticated production smoke test remain required.

## Release-isolation audit — 2026-11-17

- The current production `main` baseline does not contain the Group 05 memory route, session bootstrap route, or their supporting modules. In particular, `src/routes/api/auth/session.ts` and `src/routes/api/memories.ts` are absent from `main`.
- Group 05's authenticated memory API depends on the Cloudflare Access session bootstrap to provision the user, workspace, membership and session records. The isolated five-table migration alone is therefore not sufficient to activate memory.
- The feature branch contains the session bootstrap and memory implementation, but it is not a safe release candidate: comparison against production `main` reports 566 commits ahead, 6 behind and 245 changed files. Its orchestrator and home route also contain substantial later-group code, so copying those files wholesale would violate the ordered-group release boundary.
- No merge, production migration or deployment was performed. The remaining Group 05 gate is to assemble and verify a minimal Group 04/05 release that includes only the necessary conversational, Access-session and memory changes, then configure the Access application, deploy, apply `migrations/group05`, and run authenticated live CRUD/chat tests.
