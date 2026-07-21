-- Existing rows remain unexported because previous downloads cannot be verified reliably.
ALTER TABLE "lms_work_entries" ADD COLUMN "exported_at" DATETIME;

CREATE INDEX "lms_work_entries_tenant_id_user_id_exported_at_work_date_idx"
ON "lms_work_entries"("tenant_id", "user_id", "exported_at", "work_date");
