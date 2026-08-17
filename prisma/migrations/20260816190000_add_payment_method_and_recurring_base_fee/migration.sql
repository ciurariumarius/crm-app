ALTER TABLE "projects" ADD COLUMN "payment_method" TEXT;
ALTER TABLE "projects" ADD COLUMN "recurring_base_fee" DECIMAL;

UPDATE "projects"
SET "recurring_base_fee" = "current_fee"
WHERE EXISTS (
    SELECT 1
    FROM "_ProjectToService" AS project_service
    INNER JOIN "service_library" AS service ON service."id" = project_service."B"
    WHERE project_service."A" = "projects"."id"
      AND service."is_recurring" = 1
);

CREATE INDEX "projects_payment_method_idx" ON "projects"("payment_method");
