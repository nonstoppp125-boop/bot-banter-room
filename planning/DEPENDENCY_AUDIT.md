# Dependency Audit — 2026-11-16 Remote Snapshot

Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`

## Manifest and lockfiles

- Runtime dependencies: **63**.
- Development dependencies: **21**.
- `package.json`, `package-lock.json` and `bun.lock` are tracked.
- CI installs the npm lockfile with `npm ci`; Bun lockfile is present but is not the install path used by the inspected GitHub Actions build workflow.
- Main stack: React 19, TypeScript, TanStack Start/Router, Vite, Nitro, AI SDK, Groq-compatible provider, Tailwind CSS and Radix UI components.
- The full exact package/version declarations are in `package.json`; resolved transitive versions are in `package-lock.json`.

## Current automated CI evidence

Workflow: `.github/workflows/build.yml`  
Run: `43878285889`  
Code commit: `be8dca681998c0c1a618b1af858a6866de63b739`  
Job: `133337036553`

All steps succeeded:
1. Locked dependency installation.
2. Production dependency audit (`npm run security:audit`).
3. TypeScript.
4. Unit/integration tests (53 files / 410 tests).
5. Production build.
6. Nitro-generated Wrangler configuration validation.

The current package script is `npm audit --omit=dev --audit-level=high`. A successful run establishes that this configured production-only audit did not fail at the high threshold on that exact commit. It does **not** prove zero advisories, does not audit development dependencies, and does not establish current advisory status after later lockfile changes.

## Lockfile duplication snapshot

Parsed tracked lockfile v3: 837 package entries across 789 package names. 35 package names resolve to multiple versions in the dependency tree (including eslint-visitor-keys, globals, tslib, minimatch, semver, chalk, commander, d3-array, nanoid and react-is). These are transitive version multiplicities, not proof of duplicate direct dependencies or removable packages. Review dependency paths before attempting deduplication.

## Static usage review status

**Not complete.** No import-graph-based unused dependency report has yet been generated. Do not remove packages based on name/version guesses or manifest presence. Packages may be referenced through config files, dynamic imports, generated tooling or type-only imports. Before changing dependencies, scan all source, test, config and build files and classify direct runtime, development/tooling, peer/transitive, dynamically loaded and genuinely unused packages.

## Risks and limitations

- Advisory data is time-sensitive; rerun audit against the exact current lockfile before release.
- `npm audit --omit=dev` excludes development dependencies.
- A zero exit code at `--audit-level=high` is not a statement of zero vulnerabilities.
- No package was upgraded or removed during this audit.
- The successful CI run is tied to the exact code commit above, not every later branch commit.

## Remaining actions

- Complete static import/config usage graph for all 84 direct dependencies.
- Check duplicate package families and version conflicts in the resolved lockfile.
- Run current production and full dependency audits against the exact branch HEAD.
- Review licenses and maintenance/security posture for direct dependencies.
- Make changes only when evidence identifies a safe improvement, then rerun locked install, audit, typecheck, tests and build.

**Status: PARTIAL — dependency inventory and CI evidence recorded; usage, duplicates, full audit and license review remain open.**