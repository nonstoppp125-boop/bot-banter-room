# PART 05 — GROUP 05: Memory and Personalization

**Implementation status: VERIFIED (20/20) — 2026-11-17**  
**Production activation: PENDING controlled D1 migration and release**

## Scope and behavior

- Conversation history and durable memory remain separate. Durable memory is loaded only from an authenticated session and the active workspace.
- The existing `memories` table from `migrations/0005_workspace_core.sql` stores user-authored entries with category, source, timestamps, optional expiry, and soft deletion.
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

GitHub Actions run **44080900423**, commit `e36b1b8b407d01101b3745210ca71310ec4f3255`:

- 56 test files passed; 431 tests passed
- TypeScript passed
- Production dependency audit: 0 vulnerabilities
- Cloudflare Worker streaming runtime smoke test passed
- Production build passed
- Generated Wrangler configuration validation passed

The Cloudflare automatic Workers Builds check for this feature-branch commit reported failure. No feature-branch deployment was attempted. The independently deployed production Worker remains the Group 03 `main` release.

## Production activation gate and limitations

The production D1 binding exists, but Group 03 intentionally did not apply the migration set because it contains schemas owned by later groups. The memory table is created by `0005_workspace_core.sql`. Group 05 is not production-active until a controlled migration plan applies the required schema without prematurely applying later-group migrations, followed by authenticated live CRUD/chat smoke tests.

Memory retrieval is bounded and heuristic, not semantic search. Conflict detection is conservative: Liza asks the user to resolve contradictions rather than guessing. Expiry cleanup is lazy on memory list/search; this is not a scheduled database-wide purge. Users must not save secrets or highly sensitive information.

**GROUP 05 IMPLEMENTATION: COMPLETE (20/20).**  
**Do not start Group 06 until the production D1 migration/release gate is resolved.**
