-- CreateTable
CREATE TABLE "_ProjectToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProjectToService_A_fkey" FOREIGN KEY ("A") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProjectToService_B_fkey" FOREIGN KEY ("B") REFERENCES "service_library" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_auth_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "remember_device" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" DATETIME NOT NULL,
    "max_session_expires_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_auth_sessions" ("created_at", "expires_at", "id", "ip_address", "last_seen_at", "max_session_expires_at", "remember_device", "revoked_at", "tenant_id", "updated_at", "user_agent", "user_id") SELECT "created_at", "expires_at", "id", "ip_address", "last_seen_at", "max_session_expires_at", "remember_device", "revoked_at", "tenant_id", "updated_at", "user_agent", "user_id" FROM "auth_sessions";
DROP TABLE "auth_sessions";
ALTER TABLE "new_auth_sessions" RENAME TO "auth_sessions";
CREATE INDEX "auth_sessions_tenant_id_user_id_revoked_at_idx" ON "auth_sessions"("tenant_id", "user_id", "revoked_at");
CREATE INDEX "auth_sessions_tenant_id_expires_at_idx" ON "auth_sessions"("tenant_id", "expires_at");
CREATE INDEX "auth_sessions_tenant_id_max_session_expires_at_idx" ON "auth_sessions"("tenant_id", "max_session_expires_at");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_partners" ("business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", "tenant_id", "updatedAt") SELECT "business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", "tenant_id", "updatedAt" FROM "partners";
DROP TABLE "partners";
ALTER TABLE "new_partners" RENAME TO "partners";
CREATE INDEX "partners_tenant_id_idx" ON "partners"("tenant_id");
CREATE UNIQUE INDEX "partners_tenant_id_id_key" ON "partners"("tenant_id", "id");
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_tenant_id_site_id_fkey" FOREIGN KEY ("tenant_id", "site_id") REFERENCES "sites" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt") SELECT "createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX "projects_site_id_idx" ON "projects"("site_id");
CREATE INDEX "projects_tenant_id_site_id_idx" ON "projects"("tenant_id", "site_id");
CREATE INDEX "projects_tenant_id_createdAt_idx" ON "projects"("tenant_id", "createdAt");
CREATE INDEX "projects_tenant_id_updatedAt_idx" ON "projects"("tenant_id", "updatedAt");
CREATE INDEX "projects_tenant_id_status_createdAt_idx" ON "projects"("tenant_id", "status", "createdAt");
CREATE INDEX "projects_tenant_id_payment_status_createdAt_idx" ON "projects"("tenant_id", "payment_status", "createdAt");
CREATE INDEX "projects_tenant_id_current_fee_idx" ON "projects"("tenant_id", "current_fee");
CREATE INDEX "projects_tenant_id_status_updatedAt_idx" ON "projects"("tenant_id", "status", "updatedAt");
CREATE INDEX "projects_tenant_id_payment_status_updatedAt_idx" ON "projects"("tenant_id", "payment_status", "updatedAt");
CREATE UNIQUE INDEX "projects_tenant_id_id_key" ON "projects"("tenant_id", "id");
CREATE TABLE "new_rate_limit_entries" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_rate_limit_entries" ("count", "created_at", "key", "reset_at", "updated_at") SELECT "count", "created_at", "key", "reset_at", "updated_at" FROM "rate_limit_entries";
DROP TABLE "rate_limit_entries";
ALTER TABLE "new_rate_limit_entries" RENAME TO "rate_limit_entries";
CREATE INDEX "rate_limit_entries_reset_at_idx" ON "rate_limit_entries"("reset_at");
CREATE TABLE "new_service_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "standard_tasks" TEXT NOT NULL,
    "sop_link" TEXT,
    "base_fee" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_service_library" ("base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", "tenant_id", "updatedAt") SELECT "base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", "tenant_id", "updatedAt" FROM "service_library";
DROP TABLE "service_library";
ALTER TABLE "new_service_library" RENAME TO "service_library";
CREATE INDEX "service_library_tenant_id_idx" ON "service_library"("tenant_id");
CREATE INDEX "service_library_tenant_id_is_recurring_idx" ON "service_library"("tenant_id", "is_recurring");
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sites_tenant_id_partner_id_fkey" FOREIGN KEY ("tenant_id", "partner_id") REFERENCES "partners" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sites" ("createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "tenant_id", "updatedAt") SELECT "createdAt", "domain_name", "drive_link", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "tenant_id", "updatedAt" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");
CREATE INDEX "sites_partner_id_idx" ON "sites"("partner_id");
CREATE INDEX "sites_tenant_id_partner_id_idx" ON "sites"("tenant_id", "partner_id");
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "tenant_id", "updatedAt", "urgency") SELECT "createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "tenant_id", "updatedAt", "urgency" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_tenant_id_project_id_idx" ON "tasks"("tenant_id", "project_id");
CREATE INDEX "tasks_tenant_id_project_id_status_idx" ON "tasks"("tenant_id", "project_id", "status");
CREATE INDEX "tasks_tenant_id_createdAt_idx" ON "tasks"("tenant_id", "createdAt");
CREATE INDEX "tasks_tenant_id_updatedAt_idx" ON "tasks"("tenant_id", "updatedAt");
CREATE INDEX "tasks_tenant_id_name_idx" ON "tasks"("tenant_id", "name");
CREATE INDEX "tasks_tenant_id_status_deadline_idx" ON "tasks"("tenant_id", "status", "deadline");
CREATE INDEX "tasks_tenant_id_status_createdAt_idx" ON "tasks"("tenant_id", "status", "createdAt");
CREATE INDEX "tasks_tenant_id_urgency_deadline_idx" ON "tasks"("tenant_id", "urgency", "deadline");
CREATE UNIQUE INDEX "tasks_tenant_id_id_key" ON "tasks"("tenant_id", "id");
CREATE TABLE "new_tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tenants" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "tenants";
DROP TABLE "tenants";
ALTER TABLE "new_tenants" RENAME TO "tenants";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "profile_pic" TEXT,
    "password_hash" TEXT NOT NULL,
    "hourly_rate" DECIMAL DEFAULT 0,
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "id", "name", "password_hash", "profile_pic", "tenant_id", "two_factor_enabled", "two_factor_secret", "updatedAt", "username") SELECT "createdAt", "id", "name", "password_hash", "profile_pic", "tenant_id", "two_factor_enabled", "two_factor_secret", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectToService_AB_unique" ON "_ProjectToService"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectToService_B_index" ON "_ProjectToService"("B");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_project_id_idx" ON "time_logs"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_end_time_idx" ON "time_logs"("tenant_id", "end_time");
