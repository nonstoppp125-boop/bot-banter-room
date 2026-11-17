# PART 10 — GROUP 09 Research and Web Intelligence Status

Date: 2026-11-16
Branch: `work/group06-manager-planner`

## Implemented

- G09.01 — Authorized research tool contract with HTTPS allowlist validation, fixed provider endpoints, cancellation and bounded requests.
- G09.02 — Server-side Tavily Search adapter; key remains a Worker secret.
- G09.03 — Tavily Extract adapter opens selected search-result pages through the fixed provider endpoint; top three selected sources are extracted per research request.
- G09.04 — Extracted page content replaces search snippets when available; original snippets remain when extraction fails.
- G09.05 — Multi-source evidence is preserved for specialist comparison; publisher diversity is measured separately from semantic agreement.
- G09.07 — Source IDs, URLs, titles, publisher and publication dates are retained for cited reports.
- G09.08–G09.14 — Research specialist and routing support market, competitor, audience, industry, product and trend analysis and opportunity identification, subject to available source evidence.
- G09.15 — Research prompts distinguish facts, interpretations, assumptions and unknowns.
- G09.16 — Source freshness checks flag stale and undated sources.
- G09.17 — Stable source IDs and URLs are passed to specialists for citation.
- G09.18 — Source text is treated as untrusted evidence; embedded instructions are explicitly ignored.
- G09.19 — Independent quality review and deterministic citation/freshness quality assessment.
- G09.20 — Tests cover source validation, URL allowlists, cancellation, extraction, citation references, source diversity and freshness.

## Remaining limitations

- G09.06 — Implemented as a separate Groq semantic evidence-review pass. Each supported/contradicted assessment must cite an exact quote and source ID that is validated against the retrieved source text; invalid evidence is downgraded to unknown. This is a same-model second pass, not an independent model or proof of truth.
- Search, extraction and semantic review depend on configured Tavily/Groq API keys and provider availability/quotas. A second Groq pass adds token usage to research requests.
- No broad arbitrary-URL crawler or unrestricted direct-fetch tool is enabled.
- Market and competitor analysis remains bounded by the sources actually returned; no live source means no live research claim.

## Verification

- GitHub Actions run `43799513815`: SUCCESS — TypeScript, 16 test files / 178 tests, production build and Nitro-generated Wrangler validation.
- Termux's previous Vitest exit 132 remains a local environment limitation; CI is the current runtime verification evidence.

## Status

GROUP 09: COMPLETE AT CODE / CI LEVEL — semantic evidence alignment is integrated; production deployment and live provider credentials remain runtime gates.
No merge to `main`; no production deployment.


## 2026-11-16 — Specialist tool boundary integration
- Research/Web Intelligence search and selected-page extraction now execute through a specialist permission registry, rather than direct unscoped orchestrator calls.
- Missing provider key, invalid tool arguments, cross-agent access and cancellation fail closed.
- GitHub Actions run `43809939660`: SUCCESS.


## 2026-11-16 — Evidence independence hardening
- Corroboration no longer trusts source-supplied publisher labels when a URL exists; it derives publisher identity from the normalized hostname and collapses `www.` aliases.
- Added a regression test proving two differently labeled pages on the same hostname remain single-source evidence.
- This reduces false corroboration but does not provide semantic entailment or contradiction detection; G09.06 remains open.
- GitHub Actions run `43826138186`: SUCCESS — TypeScript, 46 test files / 342 tests, production build and Nitro-generated Wrangler validation.

## 2026-11-17 — G09.06 semantic evidence review

- Added a bounded second-pass Groq semantic review over research-specialist claims and the exact retrieved source excerpts.
- The verifier emits up to 12 claim assessments: `supported`, `contradicted` or `unknown`. A non-unknown verdict requires an exact quote and source ID that match the supplied source content; invalid or fabricated quotations are downgraded to `unknown`.
- Inputs are bounded to 12,000 claim characters, 8 sources and 3,000 source-content characters each. Outputs are schema-checked; malformed responses and provider errors become an explicit unavailable status. Caller cancellation propagates.
- Publication dates, publisher, retrieval date and URLs are supplied to the verifier so stale/undated evidence can be qualified.
- The final synthesis is explicitly instructed that this is a same-model assessment, not proof of truth or an independent-model verification.
- GitHub Actions run `44129498884`: SUCCESS — dependency audit 0 vulnerabilities; TypeScript PASS; 58 test files / 455 tests PASS; local workerd streaming smoke PASS; production build PASS; generated Wrangler config validation PASS.
- **Group 09: COMPLETE at code and CI level.** Tavily/Groq credentials and provider quotas remain runtime requirements. No merge or production deployment was performed.
