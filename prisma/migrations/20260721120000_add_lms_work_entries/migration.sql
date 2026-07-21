-- CreateTable
CREATE TABLE "lms_work_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lms_work_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "task_type_id" TEXT NOT NULL,
    "work_date" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "client_domain_snapshot" TEXT NOT NULL,
    "task_name_snapshot" TEXT NOT NULL,
    "employee_name_snapshot" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lms_work_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lms_work_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lms_work_entries_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "lms_work_tasks_tenant_id_normalized_name_key" ON "lms_work_tasks"("tenant_id", "normalized_name");

-- CreateIndex
CREATE INDEX "lms_work_tasks_tenant_id_is_active_name_idx" ON "lms_work_tasks"("tenant_id", "is_active", "name");

-- CreateIndex
CREATE INDEX "lms_work_entries_tenant_id_user_id_work_date_idx" ON "lms_work_entries"("tenant_id", "user_id", "work_date");

-- CreateIndex
CREATE INDEX "lms_work_entries_tenant_id_project_id_idx" ON "lms_work_entries"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "lms_work_entries_tenant_id_task_type_id_idx" ON "lms_work_entries"("tenant_id", "task_type_id");
