# Quality Gate Matrix

The quality gate evaluator is fail-closed. Missing evidence is not a pass, and passing CI does not authorize production deployment.

| Gate | Evidence required | Current boundary |
|---|---|---|
| TypeScript | CI TypeScript step | Automated |
| Unit/integration | CI test result | Automated |
| Production build | CI build result | Automated |
| Wrangler config | Generated config validation | Automated |
| Migration sequence | Unique contiguous migration versions | Automated |
| D1 apply | Successful migration against provisioned D1 | Blocked until D1 exists |
| Backup/restore | Recorded restore drill | Not run |
| Security review | Threat model and review evidence | Partial |
| API smoke | Authenticated deployed endpoint checks | Not run |
| Mobile smoke | Physical Android/iOS install and interaction | Not run |
| Accessibility | Keyboard, screen reader and contrast review | Partial |
| Privacy | Data retention/export/deletion and consent review | Not run |
| Release sign-off | Human approval and rollback plan | Not granted |

## Release policy

- passed means only the listed evidence was verified.
- blocked or not-run prevents readiness.
- failed blocks release.
- The evaluator always returns deploymentAllowed: false.
- Production promotion requires a separate explicit human decision.
