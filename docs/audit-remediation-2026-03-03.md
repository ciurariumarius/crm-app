# CRM App Audit Remediation Plan (2026-03-03)

> Historical document. It describes the application at the time of the
> 2026-03-03 audit. Current single-owner security and deployment controls are
> documented in `README.md` and `docs/technical-audit-2026-07-23.md`.

This document tracks findings and concrete fixes from architecture, code quality, performance, and security audit.

## UI/UX + Mobile audit (2026-03-03, localhost run)

Verified with automated login/screenshots on `http://127.0.0.1:3100` using test user credentials.

### Implemented now

1. Mobile accessibility viewport fix
- `app/layout.tsx`
- Removed `maximumScale: 1` to restore browser zoom for low-vision users.

2. Safer mobile viewport sizing
- `app/layout.tsx`
- Replaced `h-screen` shell containers with `min-h-dvh` to reduce iOS/Android address-bar jump/crop issues.

3. Navigation accessibility labels
- `components/layout/mobile-menu-trigger.tsx`
- `components/layout/sidebar.tsx`
- Added `aria-label`, `aria-expanded`, and `aria-controls` on key mobile navigation controls.

4. Filter control accessibility in tasks
- `components/tasks/tasks-toolbar.tsx`
- Added button `type="button"` and explicit `aria-label` values on clear/reset icon controls.

5. Mobile Projects layout breakage fix
- `components/projects/projects-table.tsx`
- For list mode, mobile now renders card/grid layout instead of clipped wide-row table layout.
- Desktop list remains unchanged.

6. Global timer mobile ergonomics
- `components/layout/global-timer.tsx`
- Reduced collapsed FAB size on mobile and updated fixed positioning with safe-area-aware bottom offset.

### Remaining UX issues to address

1. Visual density and tiny all-caps typography on mobile
- Multiple screens rely heavily on `text-[10px]` + uppercase labels, reducing readability and scan speed.

2. Excessive "micro-badge" visual noise
- Status/type/payment tags compete with primary content; simplify by reducing simultaneous badge count per card.

3. Keyboard navigation parity on desktop contextual rail
- `components/layout/sidebar.tsx`
- Drawer discovery is primarily hover-driven; add focus-triggered opening and explicit submenu toggles for keyboard users.

## Implemented in this patch set

1. Authentication enforcement for read/server actions
- `lib/actions/time.ts`
- `lib/actions/projects.ts`
- Added `requireAuth()` to `getTimeLogs`, `getActiveTimer`, `resumeTimer`, and `getProjectDetails`.

2. Input validation hardening with Zod
- `lib/actions/partners.ts`
- `lib/actions/services.ts`
- `lib/actions/sites.ts`
- `lib/actions/tasks.ts`
- Added schema validation for IDs, payloads, enums, lengths, and basic URL/email checks.

3. Heavy global layout query reduction
- `app/layout.tsx`
- Removed non-essential global DB reads from layout-level rendering.
- Kept only user profile and active timer fetch for shared shell.

4. Cron endpoint hardening and auth decoupling
- `app/api/cron/rollover/route.ts`
- Added dual header auth support (`Authorization: Bearer ...` or `x-cron-secret`).
- Added `POST` handler alongside `GET`.
- Removed dependency on `createProject` server action (which requires a user session).
- Implemented local transaction-based rollover project/task creation.

5. JWT helper typing cleanup
- `lib/auth.ts`
- Added typed `SessionPayload`, generic `decrypt<T>()`, and typed `getSession()` usage.

6. Database indexing for frequent filters/sorts
- `prisma/schema.prisma`
- Added indexes for: `Site.partnerId`, `Project.siteId/status/paymentStatus/createdAt/updatedAt`,
  `Task.projectId/status/urgency/deadline`, `TimeLog.projectId/taskId/startTime/endTime/isPaused`.

7. Safer remote dev script defaults
- `start-remote-dev.sh`
- Added `set -euo pipefail`.
- Removed forced insecure SSH by default.
- Added optional `INSECURE_SSH=1` override.
- Replaced hardcoded user references with `REMOTE_USER`.

8. Database-backed authentication rate limiting
- `prisma/schema.prisma`
- `lib/rate-limit.ts`
- Replaced in-memory limiter with `RateLimitEntry` table-backed limiter.
- Added cleanup helper for expired limiter entries.
- Auth keys now include `username + client IP` and `userId + client IP`.

9. Authentication audit logging
- `prisma/schema.prisma`
- `lib/audit.ts`
- `lib/actions/auth.ts`
- Added `AuditLog` model and non-blocking event logger.
- Logs now cover login success/failure, 2FA challenge/success/failure, rate-limited events, and logout.

10. Tenant model + scoped query enforcement
- `prisma/schema.prisma`
- `prisma/migrations/20260303170000_add_tenant_model/migration.sql`
- `lib/auth.ts`
- `lib/tenant.ts`
- `lib/actions/*.ts` (auth/partners/projects/services/sites/tasks/time)
- `app/**/*.tsx` key server pages
- Added `Tenant` model and `tenantId` ownership columns to core domain tables.
- Session now carries `tenantId` and middleware enforces tenant presence.
- All core reads/writes now include tenant scoping filters.
- Added data migration SQL that backfills existing records into a default tenant.

## Remaining high-priority fixes (not yet implemented)

1. Production key management for encrypted secrets
- `User.twoFactorSecret` encryption-at-rest is implemented.
- Remaining step: move key management to KMS/HSM-backed secret rotation for production operations.

2. Centralized error taxonomy adoption across all routes
- `ActionError` + safe fallback messages were added for core actions.
- Remaining step: standardize the same error model in API route handlers and long-running scripts.

3. Additional UX accessibility cleanup
- Some screens still rely on very small uppercase labels and dense micro-badges.
- Remaining step: increase minimum text size and simplify badge density for mobile readability.

## Batch 1 implementation update (2026-03-03)

Implemented in this batch:

1. Stronger tenant ownership at DB relation level
- `prisma/schema.prisma`
- Added composite uniqueness and composite foreign keys on:
  - `Site -> Partner` via `(tenant_id, partner_id) -> partners(tenant_id, id)`
  - `Project -> Site` via `(tenant_id, site_id) -> sites(tenant_id, id)`
  - `Task -> Project` via `(tenant_id, project_id) -> projects(tenant_id, id)`
  - `TimeLog -> Project` via `(tenant_id, project_id) -> projects(tenant_id, id)`

2. Cron rollover idempotency + atomicity
- `app/api/cron/rollover/route.ts`
- Added `project_rollovers` idempotency tracking usage.
- Per-project rollover now runs in one transaction:
  - old project completion
  - new project creation
  - task creation
  - marker update
- `GET` is now `405 Method Not Allowed`; mutation is `POST` only.

3. 2FA secret encryption at rest
- `lib/crypto.ts`
- `lib/actions/auth.ts`
- Added AES-256-GCM encryption/decryption helpers using `DATA_ENCRYPTION_KEY`.
- New 2FA secrets are encrypted before persistence.
- Verification supports legacy plaintext secrets and opportunistically migrates them to encrypted form.

4. Server-side ownership check hardening for project creation
- `lib/actions/projects.ts`
- `createProject` now validates site ownership (`tenantId + siteId`) for all create paths (not only auto-generated name path).

5. High-impact index improvements for common tenant-scoped queries
- `prisma/schema.prisma`
- Added composite indexes:
  - `projects(tenant_id, status, updatedAt)`
  - `projects(tenant_id, payment_status, updatedAt)`
  - `tasks(tenant_id, status, createdAt)`
  - `tasks(tenant_id, urgency, deadline)`
  - `time_logs(tenant_id, start_time)`
  - `time_logs(tenant_id, is_paused, end_time)`

6. Build reliability improvement in restricted networks
- `app/layout.tsx`
- `app/globals.css`
- Removed runtime dependency on Google Fonts fetch at build time.
- Introduced local fallback `--font-jakarta` stack.

7. Next.js middleware convention migration
- `proxy.ts`
- `middleware.ts` removed
- Migrated to Next.js 16 `proxy` convention to remove deprecation warnings.

8. Prisma config migration from deprecated package.json field
- `prisma.config.ts`
- `package.json`
- Moved Prisma config out of `package.json#prisma` to `prisma.config.ts`.

## Batch 2 implementation update (2026-03-03)

Implemented in this batch:

1. Stronger auth throttling
- `lib/actions/auth.ts`
- Added network-level login rate limiting (`login_ip:*`) in addition to username+IP limits.
- Added network-level 2FA verification rate limiting (`2fa_ip:*`).

2. 2FA disable re-authentication
- `lib/actions/auth.ts`
- `app/settings/settings-content.tsx`
- Disabling 2FA now requires current password verification server-side.
- UI now asks for current password before disabling.

3. Security header hardening
- `next.config.ts`
- Added a baseline `Content-Security-Policy` header to reduce script/style/resource injection surface.

4. Operational cleanup in cron
- `app/api/cron/rollover/route.ts`
- Added opportunistic expired rate-limit entry cleanup during cron execution.

## Batch 3 implementation update (2026-03-03)

Implemented in this batch:

1. Project listing query budget control
- `app/projects/page.tsx`
- Added server-side pagination (`page`, `skip`, `take`) with total count.
- Added next/previous pagination controls while preserving filter state.

2. Tasks page duplicated query removal
- `app/tasks/page.tsx`
- Removed duplicate project fetch by reusing a single project query for both:
  - create-task project selector
  - toolbar filter project list

3. Analytics overfetch reduction
- `app/analytics/page.tsx`
- Removed per-project `timeLogs` include from projects query.
- Replaced with `timeLog.groupBy(projectId)` and lightweight project `select`.
- Preserved partner/service/revenue outputs with less DB payload.

## Batch 4 implementation update (2026-03-03)

Implemented in this batch:

1. Extended destructive CRUD audit coverage
- `lib/actions/partners.ts`
- `lib/actions/services.ts`
- `lib/actions/sites.ts`
- `lib/actions/projects.ts`
- `lib/actions/tasks.ts`
- `lib/actions/time.ts`
- Added success/failure audit events for create/update/delete and bulk destructive operations.
- Added timer lifecycle audit events (start/pause/resume/stop).

2. Structured action error handling baseline
- `lib/action-errors.ts`
- `lib/actions/partners.ts`
- `lib/actions/services.ts`
- `lib/actions/sites.ts`
- `lib/actions/projects.ts`
- `lib/actions/tasks.ts`
- `lib/actions/time.ts`
- Introduced typed `ActionError` and safe error-message mapping.
- Replaced raw `error.message` pass-through in core actions with fallback-safe user messages.

3. Request-context-aware session audit helper
- `lib/audit.ts`
- Added `logSessionAuditEvent(...)` to consistently include tenant/user and request metadata.

## Batch 5 implementation update (2026-03-03)

Implemented in this batch:

1. Time logs pagination + query guard rails
- `app/time/page.tsx`
- `components/time/time-logs-filters.tsx`
- `lib/actions/time.ts`
- Added server-side pagination (`page`, `take`, `skip`) and total-count return for time logs.
- Added next/previous controls and page reset behavior when filters/search change.

2. Task pagination UX consistency fix
- `components/tasks/tasks-toolbar.tsx`
- Reset task page index when search/filter state changes, avoiding stale empty pages.

3. Ledger query-budget reduction
- `app/ledger/page.tsx`
- Added pagination for active-project payment cards.

## Batch 6 implementation update (2026-03-19)

Implemented in this batch:

1. Production-grade encryption key policy + key source hardening
- `lib/crypto.ts`
- Added strict production policy enforcement:
  - keyed encryption config required in production (`DATA_ENCRYPTION_KEYS` or `DATA_ENCRYPTION_KEYS_FILE`)
  - explicit active key ID required in production (`DATA_ENCRYPTION_KEY_ID`)
- Added secure file-based secret loading support (`*_FILE` env variants).
- Added non-sensitive runtime summary helper (`getEncryptionConfigSummary`).

2. 2FA secret rotation script hardening
- `scripts/rotate-two-factor-secrets.ts`
- Replaced legacy script with CLI options for safe operations:
  - `--dry-run`
  - `--strict`
  - `--tenant <tenantId>`
  - `--user <userId>`
  - `--limit <n>`
  - `--batch <n>`
- Added structured output summary for automation/ops.

3. Encryption config preflight script
- `scripts/check-encryption-config.ts`
- Added a deployment-safe preflight that validates encryption config without exposing key material.

4. Ops runbook updates
- `README.md`
- Added key config matrix and rotation commands.
- Replaced monthly full time-log scan with `timeLog.groupBy(projectId)` + lightweight project partner lookup.

## Batch 6 implementation update (2026-03-04)

Implemented in this batch:

1. API response/error standardization baseline
- `lib/api-response.ts`
- `app/api/cron/rollover/route.ts`
- Added shared helpers for `ok`, `error`, `method not allowed`, and internal error responses.
- Cron route now uses unified response shaping and status handling.
- Added timing-safe secret comparison for cron auth header checks.

2. Encryption key rotation support for secrets-at-rest
- `lib/crypto.ts`
- Added keyed envelope format `enc:v2:<keyId>:...` for new encryptions.
- Added keyring support via `DATA_ENCRYPTION_KEYS` + active key selector `DATA_ENCRYPTION_KEY_ID`.
- Kept backward compatibility for legacy `enc:v1` values and plaintext migration path.
- Added `shouldRotateSensitiveValue(...)` so auth flow can opportunistically re-encrypt old values.

3. Operational key-rotation script
- `scripts/rotate-two-factor-secrets.ts`
- `package.json`
- Added `npm run security:rotate-2fa-secrets` to bulk re-encrypt existing `twoFactorSecret` records with the active key.

## Batch 7 implementation update (2026-03-17)

Implemented in this batch:

1. Debug API hardening
- `app/api/debug/route.ts`
- `app/api/debug-server-logs/route.ts`
- Debug endpoints now require explicit enablement (`DEBUG_API_ENABLED=true`) and a configured `DEBUG_API_SECRET`.
- Removed permissive fallback behavior when secret was unset.
- Added stricter no-store/noindex response headers and normalized structured API error codes.

2. Shared constant-time secret auth helper
- `lib/http-auth.ts`
- `app/api/cron/rollover/route.ts`
- `app/api/debug/route.ts`
- `app/api/debug-server-logs/route.ts`
- Consolidated timing-safe bearer/header secret matching into a shared helper to reduce copy/paste auth code.

3. Server log endpoint guard rails
- `app/api/debug-server-logs/route.ts`
- Added env-configurable log paths and bounded tail length (`DEBUG_API_LOG_TAIL_CHARS`, clamped).
- Switched to async file reads and centralized tail extraction helper.

4. Documentation update for operational controls
- `README.md`
- Added a “Debug API Controls” section describing required/optional environment variables.

## Batch 8 implementation update (2026-03-17)

Implemented in this batch:

1. Auth throttling fail-closed fallback
- `lib/actions/auth.ts`
- If the rate-limit store errors, auth now blocks the request instead of allowing unlimited attempts.

2. Protected project note storage + signed delivery route
- `lib/project-note-storage.ts`
- `app/api/project-notes/upload/route.ts`
- `app/api/project-notes/file/route.ts`
- Uploads are persisted under protected storage (`storage/project-notes` by default), not under `public/`.
- File access now requires authenticated tenant context and a valid HMAC signature.
- Added path traversal safeguards and tenant/path ownership checks.

3. CSP tightening defaults
- `next.config.ts`
- `README.md`
- `script-src` now defaults to strict `'self'` with unsafe script allowances disabled by default.
- Added explicit env toggles for legacy compatibility:
  - `CSP_ALLOW_UNSAFE_SCRIPT_INLINE=true`
  - `CSP_ALLOW_UNSAFE_EVAL=true` (dev only)

4. Deprecated Prisma package config cleanup
- `package.json`
- Removed deprecated `package.json#prisma` config block, keeping Prisma config centralized in `prisma.config.ts`.

5. Protected storage git hygiene
- `.gitignore`
- Added `/storage/` ignore rule to prevent accidental commit of uploaded project-note assets.

## Batch 9 implementation update (2026-03-17)

Implemented in this batch:

1. Device session registry + revocation groundwork
- `prisma/schema.prisma`
- `prisma/migrations/20260317190000_add_auth_sessions/migration.sql`
- `lib/auth.ts`
- Added `AuthSession` model and migration for per-device server-side session tracking.
- Added `sid` to JWT payload when registry is enabled (`ENABLE_SESSION_REGISTRY=true`).
- Added server-side active session validation and revocation checks in `getSession`/`destroySession`.

2. Absolute+sliding session enforcement completion
- `lib/auth.ts`
- `proxy.ts`
- Added absolute max and registry-aware refresh enforcement in middleware/session refresh path.
- Proxy now rejects registry-enabled JWTs missing `sid` to force migration to tracked sessions.

3. Sensitive action step-up authentication
- `lib/auth.ts`
- `lib/actions/auth.ts`
- Added sensitive action age guard (`SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS`).
- Applied guard to high-risk account actions:
  - password change
  - 2FA secret generation
  - 2FA enable/disable

4. Active devices UI + controls in settings
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/settings/settings-content.tsx`
- Added active devices list in Settings (current device marker, UA/IP, expiry).
- Added “Sign out” per device and “Sign out other devices” actions.

5. Rollout flagging for staged adoption
- `lib/auth.ts`
- `README.md`
- Added `ENABLE_SESSION_REGISTRY` and session policy env documentation to support staged rollout.

## Batch 10 implementation update (2026-03-19)

Implemented in this batch:

1. Desktop sidebar keyboard parity (contextual rail)
- `components/layout/sidebar.tsx`
- Added focus-triggered temporary expansion for collapsed desktop sidebar:
  - keyboard focus entering the rail expands it for discoverability
  - focus leaving the rail collapses back when user preference is still collapsed
- Added explicit, accessible submenu toggles for both Data and PPC sections in collapsed and expanded states.
- Added `aria-controls`/`aria-expanded` wiring for desktop section groups and sidebar nav container.

## Batch 11 implementation update (2026-03-19)

Implemented in this batch:

1. Dense table/card typography readability normalization
- `components/payments/payments-table.tsx`
- `components/time/time-logs-table.tsx`
- `components/dashboard/financial-status-bar.tsx`
- `components/dashboard/profitability-alerts.tsx`
- Reduced use of tiny all-caps labels (`10px` uppercase) in key operational surfaces.
- Increased minimum label size and normalized casing for better scanability on desktop/mobile.
- Kept behavior unchanged (presentation-only adjustments).

## Batch 12 implementation update (2026-03-19)

Implemented in this batch:

1. Filter and domains-table readability normalization
- `components/payments/payments-filters.tsx`
- `components/time/time-logs-filters.tsx`
- `components/vault/domains-filters.tsx`
- `components/vault/sites-table.tsx`
- Updated search inputs, combobox triggers/items, clear/active chips, and table labels away from tiny uppercase-heavy typography.
- Standardized to readable mixed-case labels with slightly larger font sizing.

## Batch 13 implementation update (2026-03-19)

Implemented in this batch:

1. Dashboard mobile/tasks readability normalization
- `components/dashboard/mobile-home-view.tsx`
- `components/dashboard/upcoming-tasks.tsx`
- Reduced remaining tiny all-caps labels in dashboard mobile sections and task header/tabs/buttons.
- Increased label font sizing and tracking consistency across overview/task/project/payment sections.
- Kept behavior unchanged (presentation-only adjustments).

## Migration and rollout notes

1. Run Prisma migration for new indexes and tenant model.
- `npx prisma db execute --file prisma/migrations/20260303170000_add_tenant_model/migration.sql --schema prisma/schema.prisma`
- `npx prisma migrate resolve --applied 20260303170000_add_tenant_model`
- `npx prisma generate`
- Note: this project has historical migration drift; `db execute` is used intentionally for this step.

2. Run Batch 1 migration.
- `npx prisma db execute --file prisma/migrations/20260303193000_harden_tenant_relations_and_rollover/migration.sql --schema prisma/schema.prisma`
- `npx prisma migrate resolve --applied 20260303193000_harden_tenant_relations_and_rollover`
- `npx prisma generate`

3. Set encryption key for 2FA-at-rest:
- `DATA_ENCRYPTION_KEY=<32-byte key in base64 or 64-char hex>`
- Optional rotation-ready configuration:
  - `DATA_ENCRYPTION_KEYS=primary=<key>,secondary=<key>`
  - `DATA_ENCRYPTION_KEY_ID=primary`

4. Verify cron caller supports one of:
- `Authorization: Bearer $CRON_SECRET`
- `x-cron-secret: $CRON_SECRET`

5. Verify no workflows depend on insecure SSH defaults in `start-remote-dev.sh`.
