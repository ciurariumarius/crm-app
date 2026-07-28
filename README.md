# Pixelist CRM

Single-owner CRM and time-tracking application built with Next.js, Prisma and
SQLite. The production instance runs behind CloudPanel/Cloudflare and is
managed by PM2.

## Getting Started

Create `.env` from the production-safe configuration template, install the
locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Maintenance Commands

```bash
npm run clean:artifacts   # remove local build/temp artifacts
npm run typecheck         # TypeScript check
npm run test:unit         # focused unit and dependency compatibility tests
npm run test:data-queries # project/LMS query correctness checks
npm run runtime:preflight # migrations, config and SQLite integrity
npm run verify            # lint + typecheck + production webpack build
npm run security:audit    # fail on prod high/critical advisories
npm run security:test-guardrails  # domain/security guardrail checks
npm run security:check-public-assets
npm run data:preflight-single-owner
npm run data:migrate-project-note-storage:dry
```

The application uses a single-owner data model. Authentication, 2FA and session
management remain required, while CRM and LMS records belong directly to the
application rather than to a tenant or individual data owner.

Cleanup and context compaction guide:
- `docs/codebase-cleanup-playbook.md`
- `docs/context-map.md`
- `docs/security-checklist.md`

## Debug API Controls

Debug routes are disabled by default and are always disabled in production.

- `DEBUG_API_ENABLED=true`
- `DEBUG_API_SECRET=<strong-random-secret>`

Optional server log route controls:

- `DEBUG_API_OUT_LOG_PATH=/path/to/out.log`
- `DEBUG_API_ERR_LOG_PATH=/path/to/error.log`
- `DEBUG_API_LOG_TAIL_CHARS=10000` (min `1000`, max `200000`)

## Project Note File Controls

Project note image uploads are stored outside `public/` and served through an authenticated, signed API route.

- `PROJECT_NOTES_STORAGE_ROOT=/absolute/or/relative/path` (default `storage/project-notes`)
- `PROJECT_NOTES_SIGNING_SECRET=<strong-random-secret>` (required in production)
- `PROJECT_NOTES_SIGNED_URL_TTL_SECONDS=2592000` (default `30` days; min `60`, max `31536000`)

## CSP Controls

The request proxy generates a per-request nonce. Production `script-src` does
not permit `unsafe-inline` or `unsafe-eval`. Inline style support remains
enabled for chart/component styling. Production builds must use webpack, as
configured by `npm run build`.

## Direct production deployment

Production is published directly over SSH without a Git push:

```bash
chmod 600 .env.deploy.local
./scripts/deploy-direct.sh
```

The script performs local verification and a webpack build, backs up
source/DB/storage, promotes the complete `.next` artifact during the maintenance
window, runs health and cron smoke tests, configures PM2 log rotation and
automatically rolls back on failure. See
`docs/direct-server-deploy.md`.

## Session Controls

Session length is configurable and supports a longer "remember device" mode with sliding refresh.

- `SESSION_TTL_DAYS=7` (default for standard sign-in)
- `SESSION_REMEMBER_TTL_DAYS=3650` (default when "Keep me signed in" is checked)
- `SESSION_REFRESH_WINDOW_HOURS=72` (refresh only when token is near expiry)
- `SESSION_ABSOLUTE_MAX_DAYS=90` (maximum total age even with refresh)
- `SESSION_REMEMBER_ABSOLUTE_MAX_DAYS=36500` (absolute cap for remembered sessions)
- `SESSION_INACTIVITY_TIMEOUT_DAYS=45` (rolling inactivity limit for all sessions, including remembered sessions)
- `SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS=24` (force re-login for sensitive account actions if older)
- `ENABLE_SESSION_REGISTRY=true` (required in production; enables DB-backed per-device sessions + revocation)

In production, startup preflight fails fast if session registry is disabled or encryption keys are missing.

Use `npx prisma migrate deploy`; do not manually mark migrations as applied.

## Data Encryption Controls (2FA Secrets)

2FA secrets are encrypted with AES-256-GCM and support key IDs for rotation.

- `DATA_ENCRYPTION_KEYS=<keyId1>=<key>,<keyId2>=<key>` (preferred)
- `DATA_ENCRYPTION_KEY_ID=<activeKeyId>` (required in production strict mode)
- `DATA_ENCRYPTION_KEYS_FILE=/path/to/data_encryption_keys` (alternative to env var)
- `DATA_ENCRYPTION_KEY=<legacy-single-key>` (legacy fallback; avoid in production)
- `DATA_ENCRYPTION_KEY_FILE=/path/to/legacy_key` (alternative legacy source)
- `DATA_ENCRYPTION_STRICT_PRODUCTION=true` (default; requires keyed config + explicit key id in production)

Notes:

- Use one source per setting (`*_FILE` or direct env), not both.
- `DATA_ENCRYPTION_KEYS_FILE` supports comma-separated or newline-separated `keyId=key` entries.
- Keys must decode to exactly 32 bytes (hex-64 or base64/base64url).

Validation and rotation runbook:

```bash
npm run security:check-encryption-config
npm run security:rotate-2fa-secrets:dry
npm run security:rotate-2fa-secrets -- --strict
```

Optional scoped rotation:

```bash
npm run security:rotate-2fa-secrets -- --user <userId> --dry-run
npm run security:rotate-2fa-secrets -- --user <userId>
```

## Seed Controls

Seed credentials are no longer hardcoded.

- `SEED_ADMIN_USERNAME=admin` (optional; default `admin`)
- `SEED_ADMIN_PASSWORD=<strong-random-password>` (required for production seeding)
