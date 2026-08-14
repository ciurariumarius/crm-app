-- Keep CRM clients/projects separate from LMS while allowing Tasks to target LMS work.
ALTER TABLE "tasks" ADD COLUMN "task_scope" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "tasks" ADD COLUMN "lms_allocation_id" TEXT
  REFERENCES "lms_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD COLUMN "lms_task_type_id" TEXT
  REFERENCES "lms_work_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "tasks"
SET "task_scope" = CASE
  WHEN "project_id" IS NOT NULL THEN 'FREELANCE'
  ELSE 'GENERAL'
END;

CREATE INDEX "tasks_task_scope_status_idx" ON "tasks"("task_scope", "status");
CREATE INDEX "tasks_lms_allocation_id_idx" ON "tasks"("lms_allocation_id");
CREATE INDEX "tasks_lms_task_type_id_idx" ON "tasks"("lms_task_type_id");

-- Rebuild work entries so allocation, catalog category, and CRM Task all detach with SetNull.
-- Snapshot fields keep exported and historical rows readable after their source is removed.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_lms_work_entries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lms_allocation_id" TEXT,
  "task_type_id" TEXT,
  "crm_task_id" TEXT,
  "work_date" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "client_domain_snapshot" TEXT NOT NULL,
  "task_name_snapshot" TEXT NOT NULL,
  "crm_task_name_snapshot" TEXT,
  "employee_name_snapshot" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'MANUAL',
  "source_key" TEXT,
  "exported_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lms_work_entries_lms_allocation_id_fkey"
    FOREIGN KEY ("lms_allocation_id") REFERENCES "lms_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "lms_work_entries_task_type_id_fkey"
    FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "lms_work_entries_crm_task_id_fkey"
    FOREIGN KEY ("crm_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_lms_work_entries" (
  "id",
  "lms_allocation_id",
  "task_type_id",
  "crm_task_id",
  "work_date",
  "duration_minutes",
  "client_domain_snapshot",
  "task_name_snapshot",
  "crm_task_name_snapshot",
  "employee_name_snapshot",
  "origin",
  "source_key",
  "exported_at",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "lms_allocation_id",
  "task_type_id",
  NULL,
  "work_date",
  "duration_minutes",
  "client_domain_snapshot",
  "task_name_snapshot",
  NULL,
  "employee_name_snapshot",
  CASE
    WHEN "source_key" LIKE 'recurrence:%' THEN 'RECURRENCE'
    ELSE 'MANUAL'
  END,
  "source_key",
  "exported_at",
  "created_at",
  "updated_at"
FROM "lms_work_entries";

DROP TABLE "lms_work_entries";
ALTER TABLE "new_lms_work_entries" RENAME TO "lms_work_entries";

CREATE UNIQUE INDEX "lms_work_entries_crm_task_id_key" ON "lms_work_entries"("crm_task_id");
CREATE UNIQUE INDEX "lms_work_entries_source_key_work_date_key" ON "lms_work_entries"("source_key", "work_date");
CREATE INDEX "lms_work_entries_work_date_idx" ON "lms_work_entries"("work_date");
CREATE INDEX "lms_work_entries_exported_at_work_date_idx" ON "lms_work_entries"("exported_at", "work_date");
CREATE INDEX "lms_work_entries_lms_allocation_id_idx" ON "lms_work_entries"("lms_allocation_id");
CREATE INDEX "lms_work_entries_task_type_id_idx" ON "lms_work_entries"("task_type_id");
CREATE INDEX "lms_work_entries_origin_work_date_idx" ON "lms_work_entries"("origin", "work_date");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
