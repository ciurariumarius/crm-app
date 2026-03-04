-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "tenants" ("id", "name", "createdAt", "updatedAt") VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_audit_logs" ("action", "actor_user_id", "created_at", "details", "id", "ip_address", "success", "tenant_id", "user_agent") SELECT "action", "actor_user_id", "created_at", "details", "id", "ip_address", "success", '00000000-0000-0000-0000-000000000001', "user_agent" FROM "audit_logs";
DROP TABLE "audit_logs";
ALTER TABLE "new_audit_logs" RENAME TO "audit_logs";
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE TABLE "new_partners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "is_main_job" BOOLEAN NOT NULL DEFAULT false,
    "email_primary" TEXT,
    "email_secondary" TEXT,
    "phone" TEXT,
    "internal_notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "partners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_partners" ("business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", "tenant_id", "updatedAt") SELECT "business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", '00000000-0000-0000-0000-000000000001', "updatedAt" FROM "partners";
DROP TABLE "partners";
ALTER TABLE "new_partners" RENAME TO "partners";
CREATE INDEX "partners_tenant_id_idx" ON "partners"("tenant_id");
CREATE UNIQUE INDEX "partners_tenant_id_name_key" ON "partners"("tenant_id", "name");
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
    CONSTRAINT "projects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt") SELECT "createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", '00000000-0000-0000-0000-000000000001', "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX "projects_site_id_idx" ON "projects"("site_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_payment_status_idx" ON "projects"("payment_status");
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");
CREATE INDEX "projects_updatedAt_idx" ON "projects"("updatedAt");
CREATE TABLE "new_service_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "standard_tasks" TEXT NOT NULL,
    "sop_link" TEXT,
    "base_fee" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "service_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_service_library" ("base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", "tenant_id", "updatedAt") SELECT "base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", '00000000-0000-0000-0000-000000000001', "updatedAt" FROM "service_library";
DROP TABLE "service_library";
ALTER TABLE "new_service_library" RENAME TO "service_library";
CREATE INDEX "service_library_tenant_id_idx" ON "service_library"("tenant_id");
CREATE UNIQUE INDEX "service_library_tenant_id_service_name_key" ON "service_library"("tenant_id", "service_name");
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
    CONSTRAINT "sites_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sites" ("createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "tenant_id", "updatedAt") SELECT "createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", '00000000-0000-0000-0000-000000000001', "updatedAt" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");
CREATE INDEX "sites_partner_id_idx" ON "sites"("partner_id");
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
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "tenant_id", "updatedAt", "urgency") SELECT "createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", '00000000-0000-0000-0000-000000000001', "updatedAt", "urgency" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_urgency_idx" ON "tasks"("urgency");
CREATE INDEX "tasks_deadline_idx" ON "tasks"("deadline");
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
    CONSTRAINT "time_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_time_logs" ("createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id", "tenant_id") SELECT "createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id", '00000000-0000-0000-0000-000000000001' FROM "time_logs";
DROP TABLE "time_logs";
ALTER TABLE "new_time_logs" RENAME TO "time_logs";
CREATE INDEX "time_logs_tenant_id_idx" ON "time_logs"("tenant_id");
CREATE INDEX "time_logs_project_id_idx" ON "time_logs"("project_id");
CREATE INDEX "time_logs_task_id_idx" ON "time_logs"("task_id");
CREATE INDEX "time_logs_start_time_idx" ON "time_logs"("start_time");
CREATE INDEX "time_logs_end_time_idx" ON "time_logs"("end_time");
CREATE INDEX "time_logs_is_paused_idx" ON "time_logs"("is_paused");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "profile_pic" TEXT,
    "password_hash" TEXT NOT NULL,
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "id", "name", "password_hash", "profile_pic", "tenant_id", "two_factor_enabled", "two_factor_secret", "updatedAt", "username") SELECT "createdAt", "id", "name", "password_hash", "profile_pic", '00000000-0000-0000-0000-000000000001', "two_factor_enabled", "two_factor_secret", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

