This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Maintenance Commands

```bash
npm run clean:artifacts   # remove local build/temp artifacts
npm run typecheck         # TypeScript check
npm run verify            # lint + typecheck + build
```

Cleanup and context compaction guide:
- `docs/codebase-cleanup-playbook.md`
- `docs/context-map.md`

## Debug API Controls

Debug routes are disabled by default and require explicit opt-in.

- `DEBUG_API_ENABLED=true`
- `DEBUG_API_SECRET=<strong-random-secret>`
- `DEBUG_API_ALLOW_PRODUCTION=true` (required in production, otherwise debug routes remain disabled)

Optional server log route controls:

- `DEBUG_API_OUT_LOG_PATH=/path/to/out.log`
- `DEBUG_API_ERR_LOG_PATH=/path/to/error.log`
- `DEBUG_API_LOG_TAIL_CHARS=10000` (min `1000`, max `200000`)

## Project Note File Controls

Project note image uploads are stored outside `public/` and served through a signed, tenant-scoped API route.

- `PROJECT_NOTES_STORAGE_ROOT=/absolute/or/relative/path` (default `storage/project-notes`)
- `PROJECT_NOTES_SIGNING_SECRET=<strong-random-secret>` (required in production)
- `PROJECT_NOTES_SIGNED_URL_TTL_SECONDS=2592000` (default `30` days; min `60`, max `31536000`)

## CSP Controls

Script CSP is strict by default (`script-src 'self'`). Legacy unsafe allowances are opt-in only:

- `CSP_ALLOW_UNSAFE_SCRIPT_INLINE=true`

In development only, `unsafe-inline` and `unsafe-eval` are enabled automatically for DX tooling.

## Session Controls

Session length is configurable and supports a longer "remember device" mode with sliding refresh.

- `SESSION_TTL_DAYS=7` (default for standard sign-in)
- `SESSION_REMEMBER_TTL_DAYS=60` (default when "Keep me signed in" is checked)
- `SESSION_REFRESH_WINDOW_HOURS=72` (refresh only when token is near expiry)
- `SESSION_ABSOLUTE_MAX_DAYS=90` (maximum total age even with refresh)
- `SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS=24` (force re-login for sensitive account actions if older)
- `ENABLE_SESSION_REGISTRY=true` (enable DB-backed per-device sessions + revocation)

When `ENABLE_SESSION_REGISTRY=true`, run the auth session migration first and regenerate Prisma client:

```bash
npx prisma db execute --file prisma/migrations/20260317190000_add_auth_sessions/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260317190000_add_auth_sessions
npx prisma generate
```

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
npm run security:rotate-2fa-secrets -- --tenant <tenantId> --dry-run
npm run security:rotate-2fa-secrets -- --user <userId>
```

## Seed Controls

Seed credentials are no longer hardcoded.

- `SEED_ADMIN_USERNAME=admin` (optional; default `admin`)
- `SEED_ADMIN_PASSWORD=<strong-random-password>` (required for production seeding)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
