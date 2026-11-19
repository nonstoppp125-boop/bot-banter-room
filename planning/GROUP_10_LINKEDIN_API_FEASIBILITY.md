# Group 10 — LinkedIn API Feasibility Audit

Audit record: 2026-11-13
Scope: LI01 only. This is a feasibility assessment, not evidence of a connected account.

## Executive decision

LinkedIn integration is technically possible only within the products, scopes,
app-review status and account eligibility granted to the developer application.
The project currently has no verified LinkedIn application, OAuth callback,
approved API product, token store or connected account.

Do not implement account access based on assumed permissions.

## Capability assessment

| Capability                     | Feasibility                 | Required condition                                                                |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| Basic member identity          | Conditional                 | LinkedIn OIDC product and approved `openid`, `profile`, `email` scopes            |
| Email address                  | Conditional                 | OIDC email scope and user consent                                                 |
| Full member profile            | Not established             | Do not infer access from OIDC                                                     |
| Member post read / social data | Restricted                  | `r_member_social` is not generally available for new access                       |
| Organization page management   | Conditional                 | Eligible organization, vetted Community Management API access and approved scopes |
| Organization post read         | Conditional                 | Approved `r_organization_social` and applicable organization authorization        |
| Organization post write        | Conditional                 | Approved `w_organization_social` and required admin permissions                   |
| Member post write              | Unverified                  | Must be confirmed in the actual Developer Portal product/scope grant              |
| Analytics                      | Conditional                 | Only metrics/endpoints permitted by the granted product and tier                  |
| Competitor private analytics   | Not available by assumption | Use public, authorized information only                                           |

OIDC scopes are not equivalent to full profile access, social read access,
publishing permission or identity verification.

## OAuth and security requirements

- Use the official 3-legged OAuth authorization-code flow.
- Generate cryptographically random `state`, bind it to the initiating session,
  validate it once on callback and expire it.
- Use PKCE where supported and appropriate for the client type.
- Keep client secrets and access/refresh tokens server-side.
- Encrypt tokens at rest using a managed secret/key strategy.
- Persist token owner, granted scopes, expiry, connection state and revocation.
- Implement refresh/revocation handling only for the actual granted token model.
- Never put access tokens in browser storage, logs, URLs or client bundles.
- Do not scrape LinkedIn or bypass access controls, product restrictions or quotas.
- Require explicit user approval for publishing and account-changing actions.

Existing application CSRF middleware does not replace OAuth `state` validation.

## Project blockers

1. No verified LinkedIn Developer Application or Client ID.
2. No confirmed product approval or granted scopes.
3. No confirmed production callback URL/domain.
4. No durable encrypted token storage binding or key-management design.
5. No verified account identity or consent flow.
6. No approved API endpoint contract or integration tests.
7. No production connection-health or revocation workflow.

The current Wrangler configuration does not establish a durable LinkedIn token
store. Do not use process memory as token persistence.

## Required prerequisites before LI02–LI10

- User creates/owns the LinkedIn developer application.
- User confirms the exact production callback URL.
- Developer Portal shows the granted products and scopes.
- Choose and configure durable storage and encryption/key management.
- Define session binding, OAuth state expiry, token ownership and revocation.
- Review official API terms, quotas and organization eligibility.
- Add mocked OAuth security tests before using real credentials.

## Official documentation

- OIDC: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- Authorization code flow: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- OAuth overview: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
- Community Management API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
- Community Management API access: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-api
- API versioning and migration: https://learn.microsoft.com/en-us/linkedin/marketing/versioning

## LI01 outcome

LI01 — FEASIBILITY AUDIT DOCUMENTED.

LI02–LI30 — BLOCKED pending developer application, actual product approval,
granted scopes, callback configuration and secure persistent storage.

No LinkedIn connection, account access, publishing or analytics capability
is claimed as implemented.
