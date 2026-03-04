-- CreateTable
CREATE TABLE "project_rollovers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "source_project_id" TEXT NOT NULL,
    "new_project_id" TEXT,
    "target_year" INTEGER NOT NULL,
    "target_month" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_rollovers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_rollovers_tenant_id_source_project_id_fkey" FOREIGN KEY ("tenant_id", "source_project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_rollovers_new_project_id_fkey" FOREIGN KEY ("new_project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "paid_at" DATETIME,
    "current_fee" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_tenant_id_site_id_fkey" FOREIGN KEY ("tenant_id", "site_id") REFERENCES "sites" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt") SELECT "createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX "projects_site_id_idx" ON "projects"("site_id");
CREATE INDEX "projects_tenant_id_createdAt_idx" ON "projects"("tenant_id", "createdAt");
CREATE INDEX "projects_tenant_id_status_updatedAt_idx" ON "projects"("tenant_id", "status", "updatedAt");
CREATE INDEX "projects_tenant_id_payment_status_updatedAt_idx" ON "projects"("tenant_id", "payment_status", "updatedAt");
CREATE UNIQUE INDEX "projects_tenant_id_id_key" ON "projects"("tenant_id", "id");
CREATE TABLE "new_sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" TEXT,
    "domain_name" TEXT NOT NULL,
    "gtm_id" TEXT,
    "google_ads_id" TEXT,
    "drive_link" TEXT,
    "marketing_vault" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sites_tenant_id_partner_id_fkey" FOREIGN KEY ("tenant_id", "partner_id") REFERENCES "partners" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sites" ("createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "tenant_id", "updatedAt") SELECT "createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "tenant_id", "updatedAt" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");
CREATE INDEX "sites_partner_id_idx" ON "sites"("partner_id");
CREATE UNIQUE INDEX "sites_tenant_id_id_key" ON "sites"("tenant_id", "id");
CREATE UNIQUE INDEX "sites_tenant_id_domain_name_key" ON "sites"("tenant_id", "domain_name");
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "urgency" TEXT NOT NULL DEFAULT 'Normal',
    "deadline" DATETIME,
    "estimated_minutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "tenant_id", "updatedAt", "urgency") SELECT "createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "tenant_id", "updatedAt", "urgency" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_tenant_id_project_id_idx" ON "tasks"("tenant_id", "project_id");
CREATE INDEX "tasks_tenant_id_status_createdAt_idx" ON "tasks"("tenant_id", "status", "createdAt");
CREATE INDEX "tasks_tenant_id_urgency_deadline_idx" ON "tasks"("tenant_id", "urgency", "deadline");
CREATE UNIQUE INDEX "tasks_tenant_id_id_key" ON "tasks"("tenant_id", "id");
CREATE TABLE "new_time_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT,
    "description" TEXT,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "duration_seconds" INTEGER,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_time_logs" ("createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id", "tenant_id") SELECT "createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id", "tenant_id" FROM "time_logs";
DROP TABLE "time_logs";
ALTER TABLE "new_time_logs" RENAME TO "time_logs";
CREATE INDEX "time_logs_tenant_id_idx" ON "time_logs"("tenant_id");
CREATE INDEX "time_logs_project_id_idx" ON "time_logs"("project_id");
CREATE INDEX "time_logs_task_id_idx" ON "time_logs"("task_id");
CREATE INDEX "time_logs_tenant_id_start_time_idx" ON "time_logs"("tenant_id", "start_time");
CREATE INDEX "time_logs_tenant_id_is_paused_end_time_idx" ON "time_logs"("tenant_id", "is_paused", "end_time");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "project_rollovers_tenant_id_target_year_target_month_idx" ON "project_rollovers"("tenant_id", "target_year", "target_month");

-- CreateIndex
CREATE UNIQUE INDEX "project_rollovers_tenant_id_source_project_id_target_year_target_month_key" ON "project_rollovers"("tenant_id", "source_project_id", "target_year", "target_month");

-- CreateIndex
CREATE UNIQUE INDEX "partners_tenant_id_id_key" ON "partners"("tenant_id", "id");

