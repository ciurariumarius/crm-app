# Quarterly Security Checklist

Run this checklist once per quarter and before major releases.

1. Dependency and supply-chain checks
- Run `npm run security:audit` and resolve all high/critical findings.
- Review stale dependencies and open update PRs.

2. Secrets and encryption hygiene
- Run `npm run security:check-encryption-config` in production-like environment.
- Dry-run rotation with `npm run security:rotate-2fa-secrets:dry`.
- Execute strict rotation if needed and verify successful decrypt/read paths.

3. Session and auth controls
- Confirm `ENABLE_SESSION_REGISTRY=true` in production.
- Verify session revocation works (logout all other devices, revoke current device).
- Verify inactivity expiry enforcement and successful re-auth flow.

4. Data exposure checks
- Confirm no backup artifacts (`*.bak`, DB dumps) are tracked in git.
- Confirm uploads are stored outside public static paths.
- Verify debug APIs remain inaccessible in production.

5. Observability checks
- Confirm audit events are present for auth anomalies, blocked SSRF/domain attempts, and debug-route access denials.
- Spot check recent audit rows for expected metadata (action, success, tenant/user where applicable).
