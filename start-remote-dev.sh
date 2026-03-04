#!/bin/bash
# start-remote-dev.sh
set -euo pipefail

REMOTE_HOST="152.53.116.233"
REMOTE_USER="populatia-crm"
REMOTE_DIR="/home/populatia-crm/htdocs/crm.populatia.ro"
REMOTE_PORT="22"
SSH_ROOT_USER="${SSH_ROOT_USER:-root}"
INSECURE_SSH="${INSECURE_SSH:-0}"
SSH_OPTS="-p ${REMOTE_PORT}"

if [ "${INSECURE_SSH}" = "1" ]; then
  SSH_OPTS="${SSH_OPTS} -o StrictHostKeyChecking=no"
fi

echo "====================================="
echo "STARTING REMOTE DEV ENVIRONMENT"
echo "====================================="

# Step 1: Connect as root to switch user, stop PM2 production, and run dev server
ssh -t ${SSH_OPTS} ${SSH_ROOT_USER}@${REMOTE_HOST} << EOF
  # Stop PM2 production server across all apps for this user
  su - ${REMOTE_USER} -c "npx pm2 stop all || true"
  
  # Start the Next.js dev server interactively
  echo "=> Starting Next.js in DEV mode..."
  su - ${REMOTE_USER} -c "cd ${REMOTE_DIR} && npm run dev"
  
  # When the user exits the ssh session (Ctrl+C), we should restart PM2 to keep the site online
  echo "=> Restoring PM2 Production Server..."
  su - ${REMOTE_USER} -c "npx pm2 restart all || true"
  exit
EOF
