#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site_path="$(cd "$script_dir/.." && pwd)"
export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

cron_secret="$(
  cd "$site_path"
  node -r dotenv/config -e 'process.stdout.write(process.env.CRON_SECRET || "")'
)"
if [[ -z "$cron_secret" ]]; then
  echo "Notes retention skipped: CRON_SECRET is missing"
  exit 1
fi

curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer $cron_secret" \
  "http://127.0.0.1:3000/api/cron/notes-retention"
