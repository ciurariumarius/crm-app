#!/bin/bash
# start-remote-dev.sh

REMOTE_HOST="152.53.116.233"
REMOTE_USER="populatia-crm"
REMOTE_DIR="/home/populatia-crm/htdocs/crm.populatia.ro"
REMOTE_PORT="22"

echo "====================================="
echo "🚀 STARTING REMOTE DEV ENVIRONMENT"
echo "====================================="

# Step 1: Connect as root to switch user, stop PM2 production, and run dev server
ssh -t -o StrictHostKeyChecking=no root@${REMOTE_HOST} << EOF
  # Stop PM2 production server across all apps for this user
  su - populatia-crm -c "npx pm2 stop all || true"
  
  # Start the Next.js dev server interactively
  echo "=> Starting Next.js in DEV mode..."
  su - populatia-crm -c "cd ${REMOTE_DIR} && npm run dev"
  
  # When the user exits the ssh session (Ctrl+C), we should restart PM2 to keep the site online
  echo "=> Restoring PM2 Production Server..."
  su - populatia-crm -c "npx pm2 restart all || true"
  exit
EOF
