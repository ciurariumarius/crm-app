#!/bin/bash
# start-remote-dev.sh
set -euo pipefail

REMOTE_HOST="152.53.116.233"
REMOTE_USER="populatia-crm"
REMOTE_DIR="/home/populatia-crm/htdocs/crm.populatia.ro"
REMOTE_PORT="22"
SSH_ROOT_USER="${SSH_ROOT_USER:-$REMOTE_USER}"
INSECURE_SSH="${INSECURE_SSH:-0}"
USE_ROOT_SWITCH="${USE_ROOT_SWITCH:-0}"
SSH_OPTS="-p ${REMOTE_PORT}"

if [ "${INSECURE_SSH}" = "1" ]; then
  SSH_OPTS="${SSH_OPTS} -o StrictHostKeyChecking=no"
fi

echo "====================================="
echo "STARTING REMOTE DEV ENVIRONMENT"
echo "====================================="

# Step 1: Connect and run under the app user by default. Root switch is opt-in.
ssh -t ${SSH_OPTS} ${SSH_ROOT_USER}@${REMOTE_HOST} << EOF
  if [ "${USE_ROOT_SWITCH}" = "1" ] && [ "${SSH_ROOT_USER}" = "root" ]; then
    su - ${REMOTE_USER} -c "npx pm2 stop all || true"
    echo "=> Starting Next.js in DEV mode..."
    su - ${REMOTE_USER} -c "cd ${REMOTE_DIR} && npm run dev"
    echo "=> Restoring PM2 Production Server..."
    su - ${REMOTE_USER} -c "npx pm2 restart all || true"
  else
    npx pm2 stop all || true
    echo "=> Starting Next.js in DEV mode..."
    cd ${REMOTE_DIR} && npm run dev
    echo "=> Restoring PM2 Production Server..."
    npx pm2 restart all || true
  fi
EOF
