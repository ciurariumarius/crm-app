-- RedefineTables
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_lms_work_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lms_allocation_id" TEXT,
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
    CONSTRAINT "lms_work_entries_lms_allocation_id_fkey" FOREIGN KEY ("lms_allocation_id") REFERENCES "lms_allocations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lms_work_entries_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

INSERT INTO "new_lms_work_entries" (
    "id",
    "tenant_id",
    "user_id",
    "lms_allocation_id",
    "task_type_id",
    "work_date",
    "duration_minutes",
    "client_domain_snapshot",
    "task_name_snapshot",
    "employee_name_snapshot",
    "created_at",
    "updated_at"
)
SELECT
    entry."id",
    entry."tenant_id",
    entry."user_id",
    (
        SELECT allocation."id"
        FROM "lms_allocations" AS allocation
        WHERE allocation."tenant_id" = entry."tenant_id"
          AND LOWER(TRIM(allocation."client")) = LOWER(TRIM(entry."client_domain_snapshot"))
        ORDER BY allocation."id"
        LIMIT 1
    ),
    entry."task_type_id",
    entry."work_date",
    entry."duration_minutes",
    entry."client_domain_snapshot",
    entry."task_name_snapshot",
    entry."employee_name_snapshot",
    entry."created_at",
    entry."updated_at"
FROM "lms_work_entries" AS entry;

DROP TABLE "lms_work_entries";
ALTER TABLE "new_lms_work_entries" RENAME TO "lms_work_entries";

CREATE INDEX "lms_work_entries_tenant_id_user_id_work_date_idx" ON "lms_work_entries"("tenant_id", "user_id", "work_date");
CREATE INDEX "lms_work_entries_tenant_id_lms_allocation_id_idx" ON "lms_work_entries"("tenant_id", "lms_allocation_id");
CREATE INDEX "lms_work_entries_tenant_id_task_type_id_idx" ON "lms_work_entries"("tenant_id", "task_type_id");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
