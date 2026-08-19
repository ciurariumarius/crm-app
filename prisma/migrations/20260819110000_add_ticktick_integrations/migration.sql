-- CreateTable
CREATE TABLE IF NOT EXISTS "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" DATETIME,
    "external_project_id" TEXT,
    "external_project_name" TEXT,
    "last_sync_at" DATETIME,
    "last_successful_sync_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_task_id" TEXT NOT NULL,
    "external_project_id" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "sync_error" TEXT,
    "sync_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_integrations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_provider_key" ON "integrations"("provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_integrations_task_id_idx" ON "task_integrations"("task_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_integrations_sync_status_idx" ON "task_integrations"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "task_integrations_provider_external_task_id_key" ON "task_integrations"("provider", "external_task_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "task_integrations_provider_task_id_key" ON "task_integrations"("provider", "task_id");
