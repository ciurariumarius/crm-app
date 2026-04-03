-- CreateTable
CREATE TABLE "lms_task_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "sync_key" TEXT NOT NULL,
    "source_id" TEXT,
    "task_date" DATETIME,
    "client" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "executant" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT '-',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_task_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lms_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "sync_key" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "specialist" TEXT NOT NULL DEFAULT 'Unassigned',
    "seo" TEXT NOT NULL DEFAULT '-',
    "gads" TEXT NOT NULL DEFAULT '-',
    "fads" TEXT NOT NULL DEFAULT '-',
    "tads" TEXT NOT NULL DEFAULT '-',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lms_task_logs_tenant_id_task_date_idx" ON "lms_task_logs"("tenant_id", "task_date");

-- CreateIndex
CREATE INDEX "lms_task_logs_tenant_id_executant_idx" ON "lms_task_logs"("tenant_id", "executant");

-- CreateIndex
CREATE INDEX "lms_task_logs_tenant_id_client_idx" ON "lms_task_logs"("tenant_id", "client");

-- CreateIndex
CREATE UNIQUE INDEX "lms_task_logs_tenant_id_sync_key_key" ON "lms_task_logs"("tenant_id", "sync_key");

-- CreateIndex
CREATE INDEX "lms_allocations_tenant_id_client_idx" ON "lms_allocations"("tenant_id", "client");

-- CreateIndex
CREATE INDEX "lms_allocations_tenant_id_specialist_idx" ON "lms_allocations"("tenant_id", "specialist");

-- CreateIndex
CREATE UNIQUE INDEX "lms_allocations_tenant_id_sync_key_key" ON "lms_allocations"("tenant_id", "sync_key");
