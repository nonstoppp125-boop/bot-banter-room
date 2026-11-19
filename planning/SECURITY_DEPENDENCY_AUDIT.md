# Dependency Security Audit — 2026-11-16

## Evidence

GitHub Actions run `43873832086` ran `npm run security:audit` (`npm audit --omit=dev --audit-level=high`) and failed as expected. The report listed 9 vulnerabilities: 7 low and 2 high.

The report identified:

- **Vite 8.1.5 — high**: advisories include GHSA-9jrq-w75r-8gcw and GHSA-rq7h-c2jc-7f22, plus related `launch-editor` advisories. npm reported a fix at Vite 8.3.8, outside the repository's exact 8.1.5 pin.
- **Zod 3.25.76 — high**: GHSA-mrhx-c7xc-m3w5. npm reported the fix at Zod 4.6.7, a major-version upgrade.
- **KaTeX 0.16.47 — advisory with no fix reported**: GHSA-238p-pmpm-9mq7 (prototype pollution can bypass trust restrictions), reached through `@streamdown/math`, `mermaid`, `remark-math` and `rehype-katex`.

Do not infer that the KaTeX advisory is one of the two high findings; the audit excerpt did not print its severity.

## Current CI/release policy

- Build CI and the manual production deployment workflow now both run `npm run security:audit` (`npm audit --omit=dev --audit-level=high`). High-severity findings block verification and production deployment.
- GitHub Actions run `43874074750` passed the critical-threshold audit step, TypeScript, 51 test files / 400 tests, production build and generated Wrangler Worker config validation. This is not evidence that high findings are fixed.

## Remediation required

1. Upgrade Vite to a patched compatible release (at least the reported 8.3.8) and regenerate the lockfile using npm; run the full suite and Worker build.
2. Plan and test the Zod 3 to Zod 4.6.7 migration. Do not use `npm audit fix --force` blindly; review direct imports, SDK peer dependencies and validation behavior.
3. Review whether untrusted math rendering can be disabled or isolated until KaTeX has a fixed release; keep trust restrictions disabled and add regression coverage.
4. Re-run the high-threshold audit and record a clean result before enabling production deployment.

No dependency was force-upgraded in this batch because the Zod change is breaking and the repository lockfile must be regenerated and tested.


## 2026-11-16 — Isolated remediation result

- Updated direct Vite to `^8.3.8` and Zod to `^4.6.7`; npm regenerated the lockfile in an isolated branch.
- GitHub Actions remediation run `43874594406`: TypeScript, 51 test files / 400 tests and production build all passed.
- The post-upgrade npm audit reported 7 low, 0 moderate, 0 high and 0 critical vulnerabilities. KaTeX's advisory remains within the remaining low findings; no fixed release was reported.
- These dependency changes are now being revalidated on the current working-branch base before integration.
