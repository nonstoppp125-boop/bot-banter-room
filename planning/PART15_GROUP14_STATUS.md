# PART 15 — GROUP 14 Analytics and Business Intelligence Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- BI01 — Unified typed analytics snapshot schema with platform, entity, metric, period, capture time, source, dimensions and limitations.
- BI02–BI03 — Provider-neutral normalization for common platform metric aliases; invalid values and unknown metrics are rejected.
- BI04 — In-memory snapshot store plus a D1 durable adapter and indexed migration; live persistence remains unavailable until the D1 database is provisioned and bound.
- BI05 and BI14 — KPI definitions and engagement rate using tracked interactions divided by an explicitly selected impressions or reach denominator.
- BI06 — Responsive dashboard route with truthful empty state, KPI cards, platform coverage, evidence-based recommendations, trend panel and metric table; imported data remains in browser session.
- BI07–BI10 — Campaign/audience/content dimension aggregation and period trend reporting primitives; dedicated report views remain open.
- BI11 — Period comparison with absolute and percentage change; percentage change is unavailable when baseline is zero.
- BI12 — Conservative median-baseline anomaly detection requiring at least three historical observations.
- BI13 and BI18 — Evidence-based recommendations use supplied snapshots only; freshness, follower retention, exposure gaps and descriptive platform comparisons are flagged without external benchmarks.
- BI15 — Each snapshot preserves source and limitations; CSV imports are marked as user-supplied and unauthenticated.
- BI16 — CSV export escapes quotes and neutralizes spreadsheet formula-like values; browser dashboard imports canonical CSV with strict size/row bounds and offers local CSV download.
- BI17 — Executive summary reports totals and missing metrics honestly.
- BI19 — Data freshness helper reports missing, fresh or stale.
- BI20 — Tests cover normalization, invalid data, idempotency, KPI arithmetic, comparisons, anomalies, freshness, CSV import/export safety, dimensions, trends, recommendations and missing metrics.

## Remaining / blocked
- Durable analytics history and ingestion adapters require a provisioned database and authorized platform APIs.
- Dedicated campaign/audience/content/trend report views remain open.
- Metric availability and definitions vary by platform/account permission; source metadata is mandatory.

GROUP 14: IN PROGRESS — core schema, normalization, KPI, CSV workflow, dashboard and reporting foundations implemented; persistence and live platform adapters remain open.
No merge to main; no production deployment.


## 2026-11-16 — Workspace isolation hardening

- Added migration `0013_workspace_scoped_analytics.sql` with a nullable workspace foreign key and workspace/period index. Existing legacy snapshots remain unscoped and are intentionally not exposed by workspace-scoped reads.
- Changed the durable D1 analytics adapter to require a validated workspace ID. Writes, idempotency lookups and list queries are all scoped to that workspace.
- Added regression coverage for workspace-scoped writes, reads and invalid workspace IDs.
- CI run `43827000844` passed TypeScript, 46 test files / 343 tests, production build and Nitro-generated Wrangler configuration validation.
- Still open: authenticated analytics API, explicit save/load UI, dedicated campaign/audience/content/trend report views, D1 provisioning and live platform adapters. No production persistence or provider integration is claimed.


## 2026-11-16 — Workspace analytics API and persistence UI

- Added `GET/POST /api/analytics`, registered in the TanStack route tree.
- Both methods require an active session and current workspace membership; POST additionally requires workspace admin role, same-origin JSON, and a bounded batch of 1–100 records.
- Imports are normalized and stored through the workspace-scoped D1 adapter. Client-supplied provenance is deliberately replaced with `user-import` and an explicit unverified-provenance limitation; imported CSV cannot claim official-provider authenticity.
- Analytics page now loads saved workspace snapshots and persists CSV imports. “Clear view” only clears the current display, not durable records.
- Added API tests for cross-origin rejection, authentication/configuration, workspace isolation, role gating, batch limits and invalid filters.
- Remaining: provider OAuth/official API ingestion, delete/retention controls, pagination, larger safe import workflow, and live D1 migration/runtime verification.
