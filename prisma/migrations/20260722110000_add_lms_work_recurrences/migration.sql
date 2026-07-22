CREATE TABLE "lms_work_recurrences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
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
    CONSTRAINT "lms_work_recurrences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lms_work_recurrences_lms_allocation_id_fkey" FOREIGN KEY ("lms_allocation_id") REFERENCES "lms_allocations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lms_work_recurrences_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "lms_work_tasks" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX "lms_work_recurrences_tenant_id_is_active_idx"
ON "lms_work_recurrences"("tenant_id", "is_active");

CREATE INDEX "lms_work_recurrences_tenant_id_lms_allocation_id_idx"
ON "lms_work_recurrences"("tenant_id", "lms_allocation_id");

CREATE INDEX "lms_work_recurrences_tenant_id_task_type_id_idx"
ON "lms_work_recurrences"("tenant_id", "task_type_id");

-- Use each tenant UUID as the stable administrative rule ID so legacy source
-- keys can be migrated deterministically without changing historical rows.
INSERT INTO "lms_work_recurrences" (
    "id", "tenant_id", "lms_allocation_id", "task_type_id",
    "client_snapshot", "task_snapshot", "duration_minutes", "weekday_mask",
    "is_active", "starts_on", "processed_through", "last_run_at"
)
SELECT
    t."id", t."id", a."id", wt."id",
    a."client", wt."name", 60, 31, true,
    state."started_on", state."processed_through", state."last_run_at"
FROM "tenants" t
JOIN "lms_allocations" a
  ON a."tenant_id" = t."id" AND a."client" = '[Intern]'
JOIN "lms_work_tasks" wt
  ON wt."tenant_id" = t."id" AND wt."name" = 'Task-uri administrative'
LEFT JOIN "lms_work_automation_states" state
  ON state."tenant_id" = t."id" AND state."automation_key" = 'daily-internal-admin'
WHERE a."id" = (
    SELECT a2."id" FROM "lms_allocations" a2
    WHERE a2."tenant_id" = t."id" AND a2."client" = '[Intern]'
    ORDER BY CASE WHEN a2."sync_key" = 'client:intern' THEN 0 ELSE 1 END, a2."created_at" ASC
    LIMIT 1
);

INSERT INTO "lms_work_recurrences" (
    "id", "tenant_id", "lms_allocation_id", "task_type_id",
    "client_snapshot", "task_snapshot", "duration_minutes", "weekday_mask", "is_active"
)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-8' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    t."id", a."id", wt."id", a."client", wt."name", 90, 10, true
FROM "tenants" t
JOIN "lms_allocations" a
  ON a."tenant_id" = t."id" AND a."client" = '[Intern]'
JOIN "lms_work_tasks" wt
  ON wt."tenant_id" = t."id" AND wt."name" = 'Meeting / videocall intern '
WHERE a."id" = (
    SELECT a2."id" FROM "lms_allocations" a2
    WHERE a2."tenant_id" = t."id" AND a2."client" = '[Intern]'
    ORDER BY CASE WHEN a2."sync_key" = 'client:intern' THEN 0 ELSE 1 END, a2."created_at" ASC
    LIMIT 1
);

INSERT INTO "lms_work_recurrences" (
    "id", "tenant_id", "lms_allocation_id", "task_type_id",
    "client_snapshot", "task_snapshot", "duration_minutes", "weekday_mask", "is_active"
)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-8' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    t."id", a."id", wt."id", a."client", wt."name", 30, 31, true
FROM "tenants" t
JOIN "lms_allocations" a
  ON a."tenant_id" = t."id" AND a."client" = '[Intern]'
JOIN "lms_work_tasks" wt
  ON wt."tenant_id" = t."id" AND wt."name" = 'Comunicare client / coleg - email / telefon'
WHERE a."id" = (
    SELECT a2."id" FROM "lms_allocations" a2
    WHERE a2."tenant_id" = t."id" AND a2."client" = '[Intern]'
    ORDER BY CASE WHEN a2."sync_key" = 'client:intern' THEN 0 ELSE 1 END, a2."created_at" ASC
    LIMIT 1
);

INSERT INTO "lms_work_recurrences" (
    "id", "tenant_id", "lms_allocation_id", "task_type_id",
    "client_snapshot", "task_snapshot", "duration_minutes", "weekday_mask", "is_active"
)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-8' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    t."id", a."id", wt."id", a."client", wt."name", 60, 31, true
FROM "tenants" t
JOIN "lms_allocations" a
  ON a."tenant_id" = t."id" AND a."client" = '[Intern]'
JOIN "lms_work_tasks" wt
  ON wt."tenant_id" = t."id" AND wt."name" = 'Dezvoltare'
WHERE a."id" = (
    SELECT a2."id" FROM "lms_allocations" a2
    WHERE a2."tenant_id" = t."id" AND a2."client" = '[Intern]'
    ORDER BY CASE WHEN a2."sync_key" = 'client:intern' THEN 0 ELSE 1 END, a2."created_at" ASC
    LIMIT 1
);

UPDATE "lms_work_entries"
SET "source_key" = 'recurrence:' || "tenant_id"
WHERE "source_key" = 'daily-internal-admin';

DROP TABLE "lms_work_automation_states";
