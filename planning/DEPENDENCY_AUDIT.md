# Dependency Audit — Branch Snapshot

Date: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Inspected commit: `cf0cba371f626b3123b69e2f8a2f19540bf79a7d`

## Manifest inventory

- Runtime dependencies: **63**
- Development dependencies: **21**
- Lockfile: `package-lock.json` is tracked and CI uses `npm ci`.
- Runtime: React 19, TypeScript, TanStack Start/Router, Vite, Nitro, AI SDK and Groq OpenAI-compatible provider. Exact versions are in `package.json` and `package-lock.json`.

## Automated security evidence

GitHub Actions run `43874290438` completed successfully for code commit `5ee043fde774f32a4784ba51c07e12ab05bc46a0`. Its steps include:
- Locked dependency installation (`npm ci`)
- `npm audit --omit=dev --audit-level=critical` — PASS
- TypeScript, 51 test files / 400 tests, production build and generated Wrangler validation — PASS

The repository's `security:audit` script uses `npm audit --omit=dev --audit-level=high`. CI's blocking audit currently checks critical vulnerabilities in production dependencies only; this is not a complete development-dependency or all-severity security review.

## Limitations

- Advisory results are time-dependent and must be rerun against the current lockfile.
- No dependency was upgraded solely from version-age assumptions.
- CI evidence above is tied to its exact commit, not automatically to later commits.
- No claim is made that every transitive or development dependency is vulnerability-free.
