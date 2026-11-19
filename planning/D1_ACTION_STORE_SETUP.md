# Cloudflare D1 Action Store Setup

## Current implementation

- `createD1ActionStore()` implements the `DurableActionStore` contract.
- `migrations/0001_action_claims.sql` creates a primary-key constrained claim table.
- `INSERT OR IGNORE` makes competing claims for the same key atomic at the database.
- A claim is retained if an external action fails after claiming. This deliberately
  prevents an automatic retry from repeating a potentially completed side effect.

## Provisioning

1. Create a D1 database in the intended Cloudflare account:
   `npx wrangler d1 create doot-action-store`
2. Add the returned database ID to `wrangler.json` under `d1_databases` with
   binding name `ACTION_DB` and database name `doot-action-store`.
3. Apply the migration:
   `npx wrangler d1 migrations apply doot-action-store --remote`
4. Bind `ACTION_DB` to the Worker environment and adapt it to `D1ActionDatabase`.
5. Wire the store into an approved-action executor only after explicit user
   approval and an audited external-action integration exist.

## Safety boundary

- No database ID or production binding is fabricated by this change.
- The adapter is not yet wired to a real external action executor.
- No external action is executed by this module.
- A permanent claim can require manual reconciliation after an uncertain failure.
  Do not delete claims automatically or retry an action without checking its
  external state and recording an audited recovery decision.
- Runtime behavior against a provisioned Cloudflare D1 database remains unverified.
