# Final Product Release Checklist

A release candidate is not a production release. Every blocked or not-run item prevents promotion.

- [ ] All 24 roadmap groups have completed implementation and verification.
- [ ] TypeScript, unit/integration tests, production build and Wrangler validation pass on the exact release commit.
- [ ] D1 migrations are applied in order to the intended environment.
- [ ] Backup and restore drill completed and evidence attached.
- [ ] OAuth applications, token encryption and secret rotation reviewed.
- [ ] Telegram bot token/webhook and account-linking verified, if enabled.
- [ ] Security review covers SSRF/DNS egress, auth, CSRF, multi-tenant access, approvals and audit.
- [ ] Accessibility and Android/iOS physical-device smoke tests completed.
- [ ] Privacy, retention, export and deletion behavior reviewed.
- [ ] Rollback plan rehearsed and previous worker version available.
- [ ] Human owner approves the exact commit SHA and artifact digest.
- [ ] Production promotion is performed separately through the authorized deployment workflow.
- [ ] Post-release health, error, latency, cost and quota monitoring verified.

No item is automatically checked by this document. CI success does not imply production readiness.
