# Group 05 production release checklist

This is a manual, gated release. Do not merge or deploy until repository CI checks pass and the owner has reviewed the migration scope. **Cloudflare Zero Trust and Cloudflare Access are not used. No paid plan or billing card is required.**

## 1. Configure first-party owner authentication

In GitHub → repository Settings → Secrets and variables → Actions, add these secrets (repository or production environment):

- `LIZA_AUTH_EMAIL`: the single owner login email.
- `LIZA_AUTH_PASSWORD_HASH`: PBKDF2-SHA256 hash generated locally with `node scripts/generate-password-hash.mjs`. Use a unique password of at least 16 characters. The script reads it without echoing it.\n- Login endpoint rejects request bodies larger than 4 KiB, including requests without a declared `Content-Length`.
- Existing release secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_NAME`, and `CLOUDFLARE_D1_DATABASE_ID`.

Never paste the password or hash into chat, pull requests, source files, or workflow logs. The release workflow installs the email and hash as encrypted Worker secrets; they are not written into Wrangler vars.

## 2. Group 05 migration boundary

The release workflow configures exactly one D1 binding named `ACTION_DB`. It resolves `migrations_dir` relative to the generated Wrangler config and validates the absolute path before applying anything. It applies only:

`migrations/group05/0005_memory_foundation.sql`

That migration creates users, workspaces, workspace_members, sessions, memories, and the login-throttling table.

**Never use `migrations/0005_workspace_core.sql` for this release.** It includes schemas reserved for later groups.

## 3. Manual release gate

After the PR is reviewed and merged to main:

1. Open GitHub → Actions → **Group 05 Production Release**.
2. Run it on `main`.
3. Set `confirm_release` to true only when authorizing both the remote Group 05 migration and Worker deployment.
4. If the production environment requests approval, review and approve the deployment.

The workflow reruns Group 05 tests and build, validates the isolated migration, applies it, installs the two Worker secrets, and deploys.

## 4. Authenticated live smoke tests

After deployment:

- Open the Worker URL; unauthenticated users must be redirected to `/login`.
- Sign in with the configured owner email and password.
- Verify `GET /api/auth/session` returns authenticated status.
- Verify `GET /api/memories` returns the owner's memory list.
- Add, edit, search/list, and delete a memory from `/settings/memory`.
- Send an explicit remember command in chat; verify it is saved.
- Ask an unrelated question; verify unrelated project/preferences are not injected.
- Verify ordinary messages are not saved automatically.
- Sign out; verify chat and memory API requests reject unauthenticated requests.
- Verify login throttling rejects repeated incorrect passwords.

Group 05 is complete only after these live checks pass. Group 06 must not start before then.
