/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require('child_process');

const REMOTE_USER = 'root';
const REMOTE_HOST = '152.53.116.233';
const REMOTE_DEST = '/home/populatia-crm/htdocs/crm.populatia.ro/';
const CHOWN_USER = 'populatia-crm:populatia-crm';

console.log(`\n🚀 Starting Remote Sync to ${REMOTE_HOST}...\n`);

const rsyncCommand = `rsync -avz --delete \
--exclude '.git' \
--exclude 'node_modules' \
--exclude '.next' \
--exclude '.env' \
--exclude 'sync.js' \
-e "ssh -o StrictHostKeyChecking=no" \
./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DEST}`;

const chownCommand = `ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} "chown -R ${CHOWN_USER} ${REMOTE_DEST}"`;

let isSyncing = false;
let pendingSync = false;

function runSync() {
    if (isSyncing) {
        pendingSync = true;
        return;
    }

    isSyncing = true;
    console.log(`[${new Date().toLocaleTimeString()}] ⚡ Syncing to ${REMOTE_HOST}...`);

    exec(rsyncCommand, (error) => {
        if (error) {
            console.error(`❌ Sync Failed: ${error.message}`);
            isSyncing = false;
        } else {
            // Fix permissions for CloudPanel
            exec(chownCommand, (chownErr) => {
                if (chownErr) console.error(`⚠️  Chown Failed: ${chownErr.message}`);
                console.log(`✅ Synced Successfully`);
                isSyncing = false;

                if (pendingSync) {
                    pendingSync = false;
                    runSync();
                }
            });
        }
    });
}

// Initial Sync
runSync();

// If nodemon is used, we just run this script once per nodemon trigger
// If we want native watch without nodemon:
/*
fs.watch('./', { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.git') && !filename.includes('.next')) {
        runSync();
    }
});
console.log("👀 Watching for file changes locally...");
*/
