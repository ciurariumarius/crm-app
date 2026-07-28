# Technical audit remediation — 2026-07-23

Status: implemented as one release candidate.

## Remediated

- Removed public diagnostic files and added a strict public-asset allowlist.
- Updated production dependencies and nested ExcelJS UUID compatibility.
- Added validated request context, request IDs and account-level login/2FA
  throttling.
- Replaced production inline-script CSP with per-request nonces and disabled
  the Next.js powered-by header.
- Allowed syntactically valid domains without active DNS while retaining DNS
  and private-address checks for server-side favicon requests.
- Made project-note uploads validate all files before writing, enforce a 32 MB
  request cap and clean up partial writes.
- Added a minimal database-aware health endpoint and structured redacting
  logger.
- Replaced full project task/time-log hydration with summary queries and lazy
  project details.
- Deferred global quick-action options until a dialog is opened.
- Added paged, date-filtered LMS reads with server-side totals and aggregates.
- Added unit, query-integration and deployment smoke tests.

## Accepted residual risk

The production origin is intentionally reachable directly. The application
validates proxy headers and applies account-level throttling independent of IP,
but only an origin firewall or shared proxy secret can fully prevent forwarding
header spoofing.
