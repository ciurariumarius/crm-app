DROP INDEX "lms_work_entries_tenant_id_user_id_source_key_work_date_key";

CREATE UNIQUE INDEX "lms_work_entries_tenant_id_source_key_work_date_key"
ON "lms_work_entries"("tenant_id", "source_key", "work_date");

DROP INDEX "lms_work_automation_states_tenant_id_user_id_automation_key_key";

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_lms_work_automation_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "automation_key" TEXT NOT NULL,
    "started_on" TEXT NOT NULL,
    "processed_through" TEXT,
    "last_run_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_automation_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_lms_work_automation_states" (
    "id", "tenant_id", "automation_key", "started_on", "processed_through", "last_run_at", "created_at", "updated_at"
)
SELECT
    "id", "tenant_id", "automation_key", "started_on", "processed_through", "last_run_at", "created_at", "updated_at"
FROM "lms_work_automation_states";

DROP TABLE "lms_work_automation_states";
ALTER TABLE "new_lms_work_automation_states" RENAME TO "lms_work_automation_states";

CREATE UNIQUE INDEX "lms_work_automation_states_tenant_id_automation_key_key"
ON "lms_work_automation_states"("tenant_id", "automation_key");

CREATE INDEX "lms_work_automation_states_tenant_id_idx"
ON "lms_work_automation_states"("tenant_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
