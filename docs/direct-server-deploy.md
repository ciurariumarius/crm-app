# Direct server deployment

This is the production runbook for `crm.pixelist.ro`. Deployment is performed
over SSH and does not require a commit or Git push.

## Credentials

Keep `.env.deploy.local` outside Git with mode `600`. It contains only:

- `SERVER_HOST`
- `SERVER_PORT`
- `SERVER_USER`
- `SERVER_PASSWORD`
- `SITE_PATH`

The site path must match `/home/<user>/htdocs/crm.pixelist.ro`. Never place
diagnostic output or credentials under the application's `public/` directory.
Private diagnostics belong under `$HOME/diagnostics` with mode `600`.

## Release

Run:

```bash
./scripts/deploy-direct.sh
```

The deployment:

1. runs lint, TypeScript, unit/integration guardrails, Prisma validation,
   production dependency audit and webpack build locally;
2. enters maintenance by stopping `pixelist-crm`;
3. checkpoints and backs up SQLite, source, `.next` and project-note storage;
4. synchronizes the exact local source while preserving server `.env`, DB and
   storage;
5. packages the verified local webpack build without cache/dev artifacts,
   installs production dependencies, runs Prisma preflights/migrations and
   promotes `.next` only after the artifact is complete;
6. starts PM2, checks `/api/health`, `/login` and the LMS cron dry-run;
7. verifies the exact source checksum, runs the Notes retention cron in dry-run
   mode and installs its authenticated daily schedule at 03:17;
8. enables PM2 log rotation at 10 MB, 14 retained files and compression.

If any remote step fails, the script restores the private backup and restarts
the previous source/database/storage state. Do not use `git reset --hard` as a
deployment or rollback mechanism.

The build is completed before the release switch. This prevents a failed or
interrupted server build from leaving PM2 stopped with a partial `.next`
directory.

## Post-release verification

- `/api/health` returns `{"status":"ok"}` with `Cache-Control: no-store`.
- `/login` includes a nonce-based CSP without `unsafe-inline` in `script-src`.
- `diag-*.txt` and `pm2_*.txt` return 404.
- `/api/cron/notes-retention?dryRun=1` succeeds only with `CRON_SECRET`, and the
  private crontab contains exactly one `pixelist-notes-retention` entry.
- PM2 stays online and new logs contain no `ChunkLoadError` or missing
  `.next/server/chunks` errors.
- The direct origin remains public by design. App-level validation and
  account-based throttling reduce proxy-header spoofing risk but cannot fully
  establish proxy authenticity without an origin firewall or shared secret.
