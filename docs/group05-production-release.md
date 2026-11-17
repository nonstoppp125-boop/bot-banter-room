# Group 05 production release checklist

This is a manual, gated release. Do not merge or deploy until the repository CI checks pass and the owner has reviewed the migration scope.

## 1. Protect only this Worker with Cloudflare Access

1. Open Cloudflare Dashboard → **Workers & Pages**.
2. Select **bot-banter-room**.
3. Open its **Access** tab and choose **Protect this Worker behind Access**.
4. Protect **production traffic** (choose all traffic if the UI offers Previews only vs All traffic).
5. Add an **Allow** policy for the exact email address that should use this assistant. Avoid allowing an entire public email domain unless that is intentional.
6. Apply the Access policy and verify the Worker's workers.dev URL redirects unauthenticated visitors to the Access login page.

Do not enable account-wide protection as part of this Group 05 release; that could change access to unrelated Workers.

Official guide: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## 2. Add GitHub Actions production secrets

In GitHub → repository Settings → Secrets and variables → Actions, add these repository or production environment secrets:

- **CF_ACCESS_TEAM_DOMAIN**: the Cloudflare Access team domain only, without https://.
- **CF_ACCESS_AUD**: the Audience (AUD) tag shown in the Access application details.
- **CF_ACCESS_ALLOWED_EMAIL_DOMAINS**: comma-separated email domains for the allowed identity, e.g. example.com. This is an additional backend allowlist; the Access policy should still restrict the exact user.
- Existing release secrets must also be present: **CLOUDFLARE_API_TOKEN**, **CLOUDFLARE_ACCOUNT_ID**, **CLOUDFLARE_D1_DATABASE_NAME**, and **CLOUDFLARE_D1_DATABASE_ID**.

Never paste secret values into pull requests, chat, source files, or workflow logs.

## 3. Group 05 migration boundary

The release workflow configures exactly one D1 binding named ACTION_DB. It resolves migrations_dir relative to the generated Wrangler config so that it points to the repository's migrations/group05 directory, then validates the resolved absolute path before applying anything. It applies only:

migrations/group05/0005_memory_foundation.sql

That migration creates only users, workspaces, workspace_members, sessions, and memories.

**Never use migrations/0005_workspace_core.sql for this release.** It includes schemas reserved for later groups.

## 4. Manual release gate

After the PR is approved and merged to main:

1. Open GitHub → Actions → **Group 05 Production Release**.
2. Run it on main.
3. Set confirm_release to true only when authorizing both the remote Group 05 migration and Worker deployment.
4. If the production environment requests approval, review and approve the deployment.

The workflow reruns the Group 05 release tests and build before applying the isolated migration and deploying.

## 5. Authenticated live smoke tests

After deployment, sign in through Cloudflare Access, then verify:

- GET /api/auth/session provisions a session and redirects to chat.
- GET /api/memories returns the signed-in workspace's memory list.
- Add, edit, search/list, and delete a memory from /settings/memory.
- Send an explicit remember command in chat; verify it is saved.
- Ask an unrelated question; verify unrelated project/preferences are not injected.
- Verify ordinary messages are not saved automatically.
- Sign out; verify memory API requests return an authentication error.
- Verify another account cannot read the first account's memories.

Group 05 is complete only after these live checks pass. Group 06 must not start before then.
