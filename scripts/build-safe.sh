#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${NEXT_DIST_DIR:-.next}"
LOCK_FILE="${DIST_DIR}/lock"
WAIT_SECONDS="${NEXT_BUILD_LOCK_WAIT_SECONDS:-180}"
SLEEP_SECONDS=2

lock_is_held() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi
  lsof "${LOCK_FILE}" >/dev/null 2>&1
}

if [[ -f "${LOCK_FILE}" ]]; then
  echo "Found Next.js lock at ${LOCK_FILE}."
  if lock_is_held; then
    echo "Another process currently holds the build lock. Waiting up to ${WAIT_SECONDS}s..."
    waited=0
    while lock_is_held; do
      if (( waited >= WAIT_SECONDS )); then
        echo "Timed out waiting for Next.js build lock after ${WAIT_SECONDS}s."
        exit 1
      fi
      sleep "${SLEEP_SECONDS}"
      waited=$((waited + SLEEP_SECONDS))
    done
    echo "Lock released by other process."
  fi

  if [[ -f "${LOCK_FILE}" ]]; then
    echo "Removing stale lock file ${LOCK_FILE}."
    rm -f "${LOCK_FILE}"
  fi
fi

exec npx next build --webpack
