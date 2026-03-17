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

## Debug API Controls

Debug routes are disabled by default and require explicit opt-in.

- `DEBUG_API_ENABLED=true`
- `DEBUG_API_SECRET=<strong-random-secret>`

Optional server log route controls:

- `DEBUG_API_OUT_LOG_PATH=/path/to/out.log`
- `DEBUG_API_ERR_LOG_PATH=/path/to/error.log`
- `DEBUG_API_LOG_TAIL_CHARS=10000` (min `1000`, max `200000`)

## Project Note File Controls

Project note image uploads are stored outside `public/` and served through a signed, tenant-scoped API route.

- `PROJECT_NOTES_STORAGE_ROOT=/absolute/or/relative/path` (default `storage/project-notes`)
- `PROJECT_NOTES_SIGNING_SECRET=<strong-random-secret>` (falls back to `JWT_SECRET` if omitted)
- `PROJECT_NOTES_SIGNED_URL_TTL_SECONDS=2592000` (default `30` days; min `60`, max `31536000`)

## CSP Controls

Script CSP is strict by default (`script-src 'self'`). Legacy unsafe allowances are opt-in only:

- `CSP_ALLOW_UNSAFE_SCRIPT_INLINE=true`
- `CSP_ALLOW_UNSAFE_EVAL=true` (applies only in development)

## Session Controls

Session length is configurable and supports a longer "remember device" mode with sliding refresh.

- `SESSION_TTL_DAYS=7` (default for standard sign-in)
- `SESSION_REMEMBER_TTL_DAYS=60` (default when "Keep me signed in" is checked)
- `SESSION_REFRESH_WINDOW_HOURS=24` (refresh only when token is near expiry)
- `SESSION_ABSOLUTE_MAX_DAYS=90` (maximum total age even with refresh)
- `SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS=24` (force re-login for sensitive account actions if older)
- `ENABLE_SESSION_REGISTRY=true` (enable DB-backed per-device sessions + revocation)

When `ENABLE_SESSION_REGISTRY=true`, run the auth session migration first and regenerate Prisma client:

```bash
npx prisma db execute --file prisma/migrations/20260317190000_add_auth_sessions/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260317190000_add_auth_sessions
npx prisma generate
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
