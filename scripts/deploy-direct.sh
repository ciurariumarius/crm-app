#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
credentials_file="${DEPLOY_ENV_FILE:-$repo_root/.env.deploy.local}"

if [[ -f "$credentials_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$credentials_file"
  set +a
fi

: "${SERVER_HOST:?SERVER_HOST is required}"
: "${SERVER_USER:?SERVER_USER is required}"
: "${SERVER_PASSWORD:?SERVER_PASSWORD is required}"
: "${SITE_PATH:?SITE_PATH is required}"
SERVER_PORT="${SERVER_PORT:-22}"

case "$SITE_PATH" in
  /home/*/htdocs/crm.populatia.ro) ;;
  *)
    echo "Refusing unexpected SITE_PATH: $SITE_PATH"
    exit 1
    ;;
esac

export SSHPASS="$SERVER_PASSWORD"
ssh_command=(sshpass -e ssh -o StrictHostKeyChecking=accept-new -p "$SERVER_PORT")
remote="$SERVER_USER@$SERVER_HOST"

if [[ "${SKIP_LOCAL_CHECKS:-0}" != "1" ]]; then
  cd "$repo_root"
  npm run security:check-public-assets
  npm run lint:all
  npm run typecheck
  npm run test:unit
  npm run test:task-lms-integration
  npm run test:payments-integration
  npm run test:filters
  npm run test:lms-work
  npm run test:lms-daily-admin
  npm run test:data-queries
  npm run security:test-guardrails
  npm run verify:mobile
  npm run verify:tablet
  npm run verify:design
  npm run security:audit
  npx prisma validate
  npm run data:preflight-single-owner
  npm run data:migrate-project-note-storage:dry
  npm run runtime:preflight
  ENABLE_SESSION_REGISTRY=true \
    DATA_ENCRYPTION_KEYS='build=0000000000000000000000000000000000000000000000000000000000000000' \
    DATA_ENCRYPTION_KEY_ID=build \
    PROJECT_NOTES_SIGNING_SECRET='build-validation-only-not-for-runtime' \
    npm run build
fi

deploy_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/home/$SERVER_USER/backups/pixelist-crm/$deploy_timestamp"
source_checksum="$(cd "$repo_root" && node scripts/source-checksum.mjs)"
[[ "$source_checksum" =~ ^[a-f0-9]{64}$ ]]
case "$backup_dir" in
  /home/*/backups/pixelist-crm/*) ;;
  *) echo "Refusing unexpected backup path"; exit 1 ;;
esac

artifact_dir="$(mktemp -d)"
artifact_path="$artifact_dir/next-artifact.tgz"
remote_artifact="$backup_dir/next-artifact.tgz"
cleanup_artifact() {
  rm -rf -- "$artifact_dir"
}
trap cleanup_artifact EXIT

[[ -f "$repo_root/.next/BUILD_ID" ]]
tar -czf "$artifact_path" \
  --exclude='.next/cache' \
  --exclude='.next/dev' \
  -C "$repo_root" \
  .next

"${ssh_command[@]}" "$remote" 'bash -s' -- "$SITE_PATH" "$backup_dir" <<'REMOTE_BACKUP'
set -Eeuo pipefail
site_path="$1"
backup_dir="$2"
case "$site_path" in
  /home/*/htdocs/crm.populatia.ro) ;;
  *) echo "Unsafe site path"; exit 1 ;;
esac
case "$backup_dir" in
  /home/*/backups/pixelist-crm/*) ;;
  *) echo "Unsafe backup path"; exit 1 ;;
esac

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
db_path="$site_path/dev.db"
storage_root="$(cd "$site_path" && node -r dotenv/config -e 'const path=require("node:path"); process.stdout.write(path.resolve(process.env.PROJECT_NOTES_STORAGE_ROOT || "storage/project-notes"))')"
case "$storage_root" in
  */project-notes) ;;
  *) echo "Unsafe project-note storage path"; exit 1 ;;
esac

mkdir -p "$backup_dir"
chmod 700 "$HOME/backups" "$HOME/backups/pixelist-crm" "$backup_dir" 2>/dev/null || true
npx pm2 stop pixelist-crm >/dev/null 2>&1 || true
if command -v sqlite3 >/dev/null 2>&1 && [[ -f "$db_path" ]]; then
  sqlite3 "$db_path" "PRAGMA wal_checkpoint(FULL);" >/dev/null
fi

(
  cd "$site_path"
  tar -czf "$backup_dir/source.tgz" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./storage/project-notes' \
    --exclude='./dev.db' \
    --exclude='./dev.db-wal' \
    --exclude='./dev.db-shm' \
    .
)
[[ -f "$db_path" ]] && cp -- "$db_path" "$backup_dir/dev.db"
[[ -f "${db_path}-wal" ]] && cp -- "${db_path}-wal" "$backup_dir/dev.db-wal"
[[ -f "${db_path}-shm" ]] && cp -- "${db_path}-shm" "$backup_dir/dev.db-shm"
if [[ -d "$storage_root" ]]; then
  cp -a -- "$storage_root" "$backup_dir/project-notes"
fi
printf 'Backup ready: %s\n' "$backup_dir"
REMOTE_BACKUP
echo "Backup created: $backup_dir"

"${ssh_command[@]}" "$remote" "cat > '$remote_artifact'" < "$artifact_path"

rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='playwright-report/' \
  --exclude='test-results/' \
  --exclude='.env*' \
  --exclude='dev.db' \
  --exclude='dev.db-wal' \
  --exclude='dev.db-shm' \
  --exclude='prisma/dev.db' \
  --exclude='prisma/dev.db-wal' \
  --exclude='prisma/dev.db-shm' \
  --exclude='storage/project-notes/' \
  --exclude='public/uploads/project-notes/' \
  --exclude='backups/' \
  -e "sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT" \
  "$repo_root/" "$remote:$SITE_PATH/"

"${ssh_command[@]}" "$remote" 'bash -s' -- "$SITE_PATH" "$backup_dir" "$remote_artifact" "$source_checksum" <<'REMOTE_DEPLOY'
set -Eeuo pipefail
site_path="$1"
backup_dir="$2"
artifact_path="$3"
expected_source_checksum="$4"
case "$site_path" in
  /home/*/htdocs/crm.populatia.ro) ;;
  *) echo "Unsafe site path"; exit 1 ;;
esac
case "$backup_dir" in
  /home/*/backups/pixelist-crm/*) ;;
  *) echo "Unsafe backup path"; exit 1 ;;
esac

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
db_path="$site_path/dev.db"
storage_root="$(cd "$site_path" && node -r dotenv/config -e 'const path=require("node:path"); process.stdout.write(path.resolve(process.env.PROJECT_NOTES_STORAGE_ROOT || "storage/project-notes"))')"
case "$storage_root" in
  */project-notes) ;;
  *) echo "Unsafe project-note storage path"; exit 1 ;;
esac
export DATABASE_URL="file:$db_path"
export PROJECT_NOTES_STORAGE_ROOT="$storage_root"
export NODE_OPTIONS="--max-old-space-size=2048"
[[ "$expected_source_checksum" =~ ^[a-f0-9]{64}$ ]]

rollback() {
  trap - ERR
  set +e
  echo "Deployment failed; restoring $backup_dir"
  npx pm2 delete pixelist-crm >/dev/null 2>&1 || true
  restore_dir="$(mktemp -d)"
  tar -xzf "$backup_dir/source.tgz" -C "$restore_dir"
  rsync -a --delete \
    --exclude='node_modules/' \
    --exclude='dev.db' \
    --exclude='dev.db-wal' \
    --exclude='dev.db-shm' \
    --exclude='storage/project-notes/' \
    "$restore_dir/" "$site_path/"
  rm -f -- "$db_path" "${db_path}-wal" "${db_path}-shm"
  [[ -f "$backup_dir/dev.db" ]] && cp -- "$backup_dir/dev.db" "$db_path"
  [[ -f "$backup_dir/dev.db-wal" ]] && cp -- "$backup_dir/dev.db-wal" "${db_path}-wal"
  [[ -f "$backup_dir/dev.db-shm" ]] && cp -- "$backup_dir/dev.db-shm" "${db_path}-shm"
  if [[ -d "$backup_dir/project-notes" ]]; then
    rm -rf -- "$storage_root"
    mkdir -p "$(dirname "$storage_root")"
    cp -a -- "$backup_dir/project-notes" "$storage_root"
  fi
  rm -rf -- "$restore_dir"
  cd "$site_path"
  npm ci
  npx prisma generate
  npx pm2 start npm --name pixelist-crm -- start -- -p 3000
  npx pm2 save >/dev/null 2>&1 || true
  echo "Rollback completed."
  exit 1
}
trap rollback ERR

cd "$site_path"
actual_source_checksum="$(node scripts/source-checksum.mjs)"
[[ "$actual_source_checksum" = "$expected_source_checksum" ]]
printf '%s  source\n' "$actual_source_checksum" > "$backup_dir/source-checksum.txt"
npm ci
npx prisma generate
npm run data:preflight-single-owner
npm run data:migrate-project-note-storage:dry
npm run data:cleanup-removed-note-features
npx prisma migrate deploy
npx prisma generate
npm run data:migrate-project-note-storage
npm run security:check-public-assets
NODE_ENV=production npm run runtime:preflight

artifact_stage="$backup_dir/artifact-stage"
mkdir -p "$artifact_stage"
tar -xzf "$artifact_path" -C "$artifact_stage"
[[ -f "$artifact_stage/.next/BUILD_ID" ]]
previous_next="$backup_dir/next-before-release"
if [[ -d "$site_path/.next" ]]; then
  mv -- "$site_path/.next" "$previous_next"
fi
mv -- "$artifact_stage/.next" "$site_path/.next"

npx pm2 delete pixelist-crm >/dev/null 2>&1 || true
npx pm2 start npm --name pixelist-crm -- start -- -p 3000
npx pm2 save >/dev/null

ready=0
for _attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health | grep -q '"status":"ok"'; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" = "1" ]]
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3000/login
cron_secret="$(node -r dotenv/config -e 'process.stdout.write(process.env.CRON_SECRET || "")')"
[[ -n "$cron_secret" ]]
curl --fail --silent --show-error --output /dev/null \
  --request POST \
  --header "Authorization: Bearer $cron_secret" \
  "http://127.0.0.1:3000/api/cron/lms-daily-admin-work?dryRun=1"
mkdir -p "$HOME/diagnostics"
chmod 700 "$HOME/diagnostics"
current_crontab="$(crontab -l 2>/dev/null || true)"
printf '%s\n' "$current_crontab" | grep -v 'pixelist-notes-retention' | sed '/^[[:space:]]*$/d' | crontab - || true

if ! npx pm2 describe pm2-logrotate >/dev/null 2>&1; then
  npx pm2 install pm2-logrotate
fi
npx pm2 set pm2-logrotate:max_size 10M
npx pm2 set pm2-logrotate:retain 14
npx pm2 set pm2-logrotate:compress true
npx pm2 save >/dev/null

trap - ERR
echo "Deployment completed with backup: $backup_dir"
REMOTE_DEPLOY

unset SSHPASS SERVER_PASSWORD
echo "Direct deployment completed."
