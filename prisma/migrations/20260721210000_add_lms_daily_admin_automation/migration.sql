ALTER TABLE "lms_work_entries" ADD COLUMN "source_key" TEXT;

CREATE TABLE "lms_work_automation_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "automation_key" TEXT NOT NULL,
    "started_on" TEXT NOT NULL,
    "processed_through" TEXT,
    "last_run_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lms_work_automation_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lms_work_automation_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lms_work_entries_tenant_id_user_id_source_key_work_date_key"
ON "lms_work_entries"("tenant_id", "user_id", "source_key", "work_date");

CREATE UNIQUE INDEX "lms_work_automation_states_tenant_id_user_id_automation_key_key"
ON "lms_work_automation_states"("tenant_id", "user_id", "automation_key");

CREATE INDEX "lms_work_automation_states_tenant_id_user_id_idx"
ON "lms_work_automation_states"("tenant_id", "user_id");
