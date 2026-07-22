-- Refuse unsafe consolidation before changing any persistent table.
PRAGMA foreign_keys=OFF;
CREATE TEMP TABLE "_single_owner_guard" (
    "tenant_count" INTEGER NOT NULL CHECK ("tenant_count" <= 1),
    "user_count" INTEGER NOT NULL CHECK ("user_count" <= 1),
    "partner_name_collisions" INTEGER NOT NULL CHECK ("partner_name_collisions" = 0),
    "domain_collisions" INTEGER NOT NULL CHECK ("domain_collisions" = 0),
    "service_collisions" INTEGER NOT NULL CHECK ("service_collisions" = 0),
    "task_log_collisions" INTEGER NOT NULL CHECK ("task_log_collisions" = 0),
    "allocation_collisions" INTEGER NOT NULL CHECK ("allocation_collisions" = 0),
    "work_task_collisions" INTEGER NOT NULL CHECK ("work_task_collisions" = 0),
    "folder_collisions" INTEGER NOT NULL CHECK ("folder_collisions" = 0),
    "rollover_collisions" INTEGER NOT NULL CHECK ("rollover_collisions" = 0),
    "work_entry_source_collisions" INTEGER NOT NULL CHECK ("work_entry_source_collisions" = 0)
);
INSERT INTO "_single_owner_guard" SELECT
    (SELECT COUNT(*) FROM "tenants"),
    (SELECT COUNT(*) FROM "users"),
    (SELECT COUNT(*) FROM (SELECT "name" FROM "partners" GROUP BY "name" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "domain_name" FROM "sites" GROUP BY "domain_name" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "service_name" FROM "service_library" GROUP BY "service_name" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "sync_key" FROM "lms_task_logs" GROUP BY "sync_key" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "sync_key" FROM "lms_allocations" GROUP BY "sync_key" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "normalized_name" FROM "lms_work_tasks" GROUP BY "normalized_name" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "name" FROM "note_folders" GROUP BY "name" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "source_project_id", "target_year", "target_month" FROM "project_rollovers" GROUP BY "source_project_id", "target_year", "target_month" HAVING COUNT(*) > 1)),
    (SELECT COUNT(*) FROM (SELECT "source_key", "work_date" FROM "lms_work_entries" WHERE "source_key" IS NOT NULL GROUP BY "source_key", "work_date" HAVING COUNT(*) > 1));
DROP TABLE "_single_owner_guard";

-- Rebuild every affected table while preserving primary keys and relationships.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_audit_logs" ("action", "actor_user_id", "created_at", "details", "id", "ip_address", "success", "user_agent") SELECT "action", "actor_user_id", "created_at", "details", "id", "ip_address", "success", "user_agent" FROM "audit_logs";
DROP TABLE "audit_logs";
ALTER TABLE "new_audit_logs" RENAME TO "audit_logs";
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE TABLE "new_auth_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_auth_sessions" ("created_at", "expires_at", "id", "ip_address", "last_seen_at", "max_session_expires_at", "remember_device", "revoked_at", "updated_at", "user_agent", "user_id") SELECT "created_at", "expires_at", "id", "ip_address", "last_seen_at", "max_session_expires_at", "remember_device", "revoked_at", "updated_at", "user_agent", "user_id" FROM "auth_sessions";
DROP TABLE "auth_sessions";
ALTER TABLE "new_auth_sessions" RENAME TO "auth_sessions";
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_sessions_max_session_expires_at_idx" ON "auth_sessions"("max_session_expires_at");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE TABLE "new_lms_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sync_key" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "specialist" TEXT NOT NULL DEFAULT 'Unassigned',
    "seo" TEXT NOT NULL DEFAULT '-',
    "gads" TEXT NOT NULL DEFAULT '-',
    "fads" TEXT NOT NULL DEFAULT '-',
    "tads" TEXT NOT NULL DEFAULT '-',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_lms_allocations" ("client", "created_at", "fads", "gads", "id", "seo", "specialist", "sync_key", "tads", "updated_at") SELECT "client", "created_at", "fads", "gads", "id", "seo", "specialist", "sync_key", "tads", "updated_at" FROM "lms_allocations";
DROP TABLE "lms_allocations";
ALTER TABLE "new_lms_allocations" RENAME TO "lms_allocations";
CREATE INDEX "lms_allocations_client_idx" ON "lms_allocations"("client");
CREATE INDEX "lms_allocations_specialist_idx" ON "lms_allocations"("specialist");
CREATE UNIQUE INDEX "lms_allocations_sync_key_key" ON "lms_allocations"("sync_key");
CREATE TABLE "new_lms_task_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sync_key" TEXT NOT NULL,
    "source_id" TEXT,
    "task_date" DATETIME,
    "client" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "executant" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT '-',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_lms_task_logs" ("client", "created_at", "duration_minutes", "executant", "id", "source_id", "status", "sync_key", "task_date", "task_name", "updated_at") SELECT "client", "created_at", "duration_minutes", "executant", "id", "source_id", "status", "sync_key", "task_date", "task_name", "updated_at" FROM "lms_task_logs";
DROP TABLE "lms_task_logs";
ALTER TABLE "new_lms_task_logs" RENAME TO "lms_task_logs";
CREATE INDEX "lms_task_logs_task_date_idx" ON "lms_task_logs"("task_date");
CREATE INDEX "lms_task_logs_executant_idx" ON "lms_task_logs"("executant");
CREATE INDEX "lms_task_logs_client_idx" ON "lms_task_logs"("client");
CREATE UNIQUE INDEX "lms_task_logs_sync_key_key" ON "lms_task_logs"("sync_key");
CREATE TABLE "new_lms_work_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lms_allocation_id" TEXT,
    "task_type_id" TEXT NOT NULL,
    "work_date" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "client_domain_snapshot" TEXT NOT NULL,
    "task_name_snapshot" TEXT NOT NULL,
    "employee_name_snapshot" TEXT NOT NULL,
    "source_key" TEXT,
    "exported_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_entries_lms_allocation_id_fkey" FOREIGN KEY ("lms_allocation_id") REFERENCES "lms_allocations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lms_work_entries_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);
INSERT INTO "new_lms_work_entries" ("client_domain_snapshot", "created_at", "duration_minutes", "employee_name_snapshot", "exported_at", "id", "lms_allocation_id", "source_key", "task_name_snapshot", "task_type_id", "updated_at", "work_date") SELECT "client_domain_snapshot", "created_at", "duration_minutes", "employee_name_snapshot", "exported_at", "id", "lms_allocation_id", "source_key", "task_name_snapshot", "task_type_id", "updated_at", "work_date" FROM "lms_work_entries";
DROP TABLE "lms_work_entries";
ALTER TABLE "new_lms_work_entries" RENAME TO "lms_work_entries";
CREATE INDEX "lms_work_entries_work_date_idx" ON "lms_work_entries"("work_date");
CREATE INDEX "lms_work_entries_exported_at_work_date_idx" ON "lms_work_entries"("exported_at", "work_date");
CREATE INDEX "lms_work_entries_lms_allocation_id_idx" ON "lms_work_entries"("lms_allocation_id");
CREATE INDEX "lms_work_entries_task_type_id_idx" ON "lms_work_entries"("task_type_id");
CREATE UNIQUE INDEX "lms_work_entries_source_key_work_date_key" ON "lms_work_entries"("source_key", "work_date");
CREATE TABLE "new_lms_work_recurrences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lms_allocation_id" TEXT,
    "task_type_id" TEXT NOT NULL,
    "client_snapshot" TEXT NOT NULL,
    "task_snapshot" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "weekday_mask" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_on" TEXT,
    "processed_through" TEXT,
    "last_run_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_recurrences_lms_allocation_id_fkey" FOREIGN KEY ("lms_allocation_id") REFERENCES "lms_allocations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lms_work_recurrences_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);
INSERT INTO "new_lms_work_recurrences" ("client_snapshot", "created_at", "duration_minutes", "id", "is_active", "last_run_at", "lms_allocation_id", "processed_through", "starts_on", "task_snapshot", "task_type_id", "updated_at", "weekday_mask") SELECT "client_snapshot", "created_at", "duration_minutes", "id", "is_active", "last_run_at", "lms_allocation_id", "processed_through", "starts_on", "task_snapshot", "task_type_id", "updated_at", "weekday_mask" FROM "lms_work_recurrences";
DROP TABLE "lms_work_recurrences";
ALTER TABLE "new_lms_work_recurrences" RENAME TO "lms_work_recurrences";
CREATE INDEX "lms_work_recurrences_is_active_idx" ON "lms_work_recurrences"("is_active");
CREATE INDEX "lms_work_recurrences_lms_allocation_id_idx" ON "lms_work_recurrences"("lms_allocation_id");
CREATE INDEX "lms_work_recurrences_task_type_id_idx" ON "lms_work_recurrences"("task_type_id");
CREATE TABLE "new_lms_work_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 1000,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_lms_work_tasks" ("created_at", "id", "is_active", "name", "normalized_name", "sort_order", "updated_at") SELECT "created_at", "id", "is_active", "name", "normalized_name", "sort_order", "updated_at" FROM "lms_work_tasks";
DROP TABLE "lms_work_tasks";
ALTER TABLE "new_lms_work_tasks" RENAME TO "lms_work_tasks";
CREATE INDEX "lms_work_tasks_is_active_name_idx" ON "lms_work_tasks"("is_active", "name");
CREATE INDEX "lms_work_tasks_sort_order_idx" ON "lms_work_tasks"("sort_order");
CREATE UNIQUE INDEX "lms_work_tasks_normalized_name_key" ON "lms_work_tasks"("normalized_name");
CREATE TABLE "new_note_folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_note_folders" ("created_at", "id", "is_default", "name", "updated_at") SELECT "created_at", "id", "is_default", "name", "updated_at" FROM "note_folders";
DROP TABLE "note_folders";
ALTER TABLE "new_note_folders" RENAME TO "note_folders";
CREATE INDEX "note_folders_is_default_idx" ON "note_folders"("is_default");
CREATE INDEX "note_folders_created_at_idx" ON "note_folders"("created_at");
CREATE UNIQUE INDEX "note_folders_name_key" ON "note_folders"("name");
CREATE TABLE "new_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folder_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" TEXT NOT NULL DEFAULT '',
    "content_text" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "note_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_notes" ("archived", "content", "content_text", "createdAt", "folder_id", "id", "pinned", "title", "updatedAt") SELECT "archived", "content", "content_text", "createdAt", "folder_id", "id", "pinned", "title", "updatedAt" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
CREATE INDEX "notes_folder_id_updatedAt_idx" ON "notes"("folder_id", "updatedAt");
CREATE INDEX "notes_archived_updatedAt_idx" ON "notes"("archived", "updatedAt");
CREATE INDEX "notes_pinned_updatedAt_idx" ON "notes"("pinned", "updatedAt");
CREATE TABLE "new_partners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "is_main_job" BOOLEAN NOT NULL DEFAULT false,
    "email_primary" TEXT,
    "email_secondary" TEXT,
    "phone" TEXT,
    "internal_notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_partners" ("business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", "updatedAt") SELECT "business_name", "createdAt", "email_primary", "email_secondary", "id", "internal_notes", "is_main_job", "name", "phone", "updatedAt" FROM "partners";
DROP TABLE "partners";
ALTER TABLE "new_partners" RENAME TO "partners";
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");
CREATE TABLE "new_project_rollovers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_project_id" TEXT NOT NULL,
    "new_project_id" TEXT,
    "target_year" INTEGER NOT NULL,
    "target_month" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_rollovers_source_project_id_fkey" FOREIGN KEY ("source_project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_rollovers_new_project_id_fkey" FOREIGN KEY ("new_project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_project_rollovers" ("created_at", "id", "new_project_id", "source_project_id", "target_month", "target_year") SELECT "created_at", "id", "new_project_id", "source_project_id", "target_month", "target_year" FROM "project_rollovers";
DROP TABLE "project_rollovers";
ALTER TABLE "new_project_rollovers" RENAME TO "project_rollovers";
CREATE INDEX "project_rollovers_target_year_target_month_idx" ON "project_rollovers"("target_year", "target_month");
CREATE UNIQUE INDEX "project_rollovers_source_project_id_target_year_target_month_key" ON "project_rollovers"("source_project_id", "target_year", "target_month");
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "site_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "paid_at" DATETIME,
    "current_fee" DECIMAL,
    "closed_at" DATETIME,
    "closed_month_key" TEXT,
    "is_heavy_revenue_month" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("closed_at", "closed_month_key", "createdAt", "current_fee", "description", "id", "is_heavy_revenue_month", "name", "paid_at", "payment_status", "site_id", "status", "updatedAt") SELECT "closed_at", "closed_month_key", "createdAt", "current_fee", "description", "id", "is_heavy_revenue_month", "name", "paid_at", "payment_status", "site_id", "status", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_site_id_idx" ON "projects"("site_id");
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");
CREATE INDEX "projects_updatedAt_idx" ON "projects"("updatedAt");
CREATE INDEX "projects_status_createdAt_idx" ON "projects"("status", "createdAt");
CREATE INDEX "projects_payment_status_createdAt_idx" ON "projects"("payment_status", "createdAt");
CREATE INDEX "projects_current_fee_idx" ON "projects"("current_fee");
CREATE INDEX "projects_status_updatedAt_idx" ON "projects"("status", "updatedAt");
CREATE INDEX "projects_payment_status_updatedAt_idx" ON "projects"("payment_status", "updatedAt");
CREATE INDEX "projects_closed_month_key_idx" ON "projects"("closed_month_key");
CREATE INDEX "projects_is_heavy_revenue_month_closed_month_key_idx" ON "projects"("is_heavy_revenue_month", "closed_month_key");
CREATE INDEX "projects_status_closed_at_idx" ON "projects"("status", "closed_at");
CREATE TABLE "new_service_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_name" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "standard_tasks" TEXT NOT NULL,
    "sop_link" TEXT,
    "base_fee" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_service_library" ("base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", "updatedAt") SELECT "base_fee", "createdAt", "id", "is_recurring", "service_name", "sop_link", "standard_tasks", "updatedAt" FROM "service_library";
DROP TABLE "service_library";
ALTER TABLE "new_service_library" RENAME TO "service_library";
CREATE INDEX "service_library_is_recurring_idx" ON "service_library"("is_recurring");
CREATE UNIQUE INDEX "service_library_service_name_key" ON "service_library"("service_name");
CREATE TABLE "new_sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partner_id" TEXT NOT NULL,
    "name" TEXT,
    "domain_name" TEXT NOT NULL,
    "favicon_url" TEXT,
    "gtm_id" TEXT,
    "google_ads_id" TEXT,
    "drive_link" TEXT,
    "marketing_vault" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sites_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sites" ("createdAt", "domain_name", "drive_link", "favicon_url", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "updatedAt") SELECT "createdAt", "domain_name", "drive_link", "favicon_url", "google_ads_id", "gtm_id", "id", "marketing_vault", "name", "partner_id", "updatedAt" FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
CREATE INDEX "sites_partner_id_idx" ON "sites"("partner_id");
CREATE UNIQUE INDEX "sites_domain_name_key" ON "sites"("domain_name");
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "urgency" TEXT NOT NULL DEFAULT 'Normal',
    "deadline" DATETIME,
    "estimated_minutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "updatedAt", "urgency") SELECT "createdAt", "deadline", "description", "estimated_minutes", "id", "name", "project_id", "status", "updatedAt", "urgency" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");
CREATE INDEX "tasks_updatedAt_idx" ON "tasks"("updatedAt");
CREATE INDEX "tasks_name_idx" ON "tasks"("name");
CREATE INDEX "tasks_status_deadline_idx" ON "tasks"("status", "deadline");
CREATE INDEX "tasks_status_createdAt_idx" ON "tasks"("status", "createdAt");
CREATE INDEX "tasks_urgency_deadline_idx" ON "tasks"("urgency", "deadline");
CREATE TABLE "new_time_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT,
    "description" TEXT,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "duration_seconds" INTEGER,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_time_logs" ("createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id") SELECT "createdAt", "description", "duration_seconds", "end_time", "id", "is_paused", "project_id", "source", "start_time", "task_id" FROM "time_logs";
DROP TABLE "time_logs";
ALTER TABLE "new_time_logs" RENAME TO "time_logs";
CREATE INDEX "time_logs_project_id_idx" ON "time_logs"("project_id");
CREATE INDEX "time_logs_task_id_idx" ON "time_logs"("task_id");
CREATE INDEX "time_logs_end_time_idx" ON "time_logs"("end_time");
CREATE INDEX "time_logs_start_time_idx" ON "time_logs"("start_time");
CREATE INDEX "time_logs_is_paused_end_time_idx" ON "time_logs"("is_paused", "end_time");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "profile_pic" TEXT,
    "password_hash" TEXT NOT NULL,
    "hourly_rate" DECIMAL DEFAULT 0,
    "timer_idle_pause_minutes" INTEGER DEFAULT 60,
    "timer_hard_cap_hours" INTEGER DEFAULT 3,
    "timer_reminder_interval_minutes" INTEGER DEFAULT 60,
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("createdAt", "hourly_rate", "id", "name", "password_hash", "profile_pic", "timer_hard_cap_hours", "timer_idle_pause_minutes", "timer_reminder_interval_minutes", "two_factor_enabled", "two_factor_secret", "updatedAt", "username") SELECT "createdAt", "hourly_rate", "id", "name", "password_hash", "profile_pic", "timer_hard_cap_hours", "timer_idle_pause_minutes", "timer_reminder_interval_minutes", "two_factor_enabled", "two_factor_secret", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
DROP TABLE "tenants";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
