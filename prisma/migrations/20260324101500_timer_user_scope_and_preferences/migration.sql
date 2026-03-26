PRAGMA foreign_keys=OFF;

ALTER TABLE "users" ADD COLUMN "timer_idle_pause_minutes" INTEGER DEFAULT 15;
ALTER TABLE "users" ADD COLUMN "timer_hard_cap_hours" INTEGER DEFAULT 3;
ALTER TABLE "users" ADD COLUMN "timer_reminder_interval_minutes" INTEGER DEFAULT 60;

CREATE TABLE "new_time_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
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
    CONSTRAINT "time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_time_logs" (
    "id",
    "tenant_id",
    "user_id",
    "project_id",
    "task_id",
    "description",
    "start_time",
    "end_time",
    "duration_seconds",
    "is_paused",
    "source",
    "createdAt"
)
SELECT
    tl."id",
    tl."tenant_id",
    (
        SELECT u."id"
        FROM "users" u
        WHERE u."tenant_id" = tl."tenant_id"
        ORDER BY u."createdAt" ASC
        LIMIT 1
    ) AS "user_id",
    tl."project_id",
    tl."task_id",
    tl."description",
    tl."start_time",
    tl."end_time",
    tl."duration_seconds",
    tl."is_paused",
    tl."source",
    tl."createdAt"
FROM "time_logs" tl;

DROP TABLE "time_logs";
ALTER TABLE "new_time_logs" RENAME TO "time_logs";

CREATE INDEX "time_logs_tenant_id_idx" ON "time_logs"("tenant_id");
CREATE INDEX "time_logs_user_id_idx" ON "time_logs"("user_id");
CREATE INDEX "time_logs_project_id_idx" ON "time_logs"("project_id");
CREATE INDEX "time_logs_tenant_id_project_id_idx" ON "time_logs"("tenant_id", "project_id");
CREATE INDEX "time_logs_tenant_id_user_id_end_time_idx" ON "time_logs"("tenant_id", "user_id", "end_time");
CREATE INDEX "time_logs_tenant_id_user_id_is_paused_end_time_idx" ON "time_logs"("tenant_id", "user_id", "is_paused", "end_time");
CREATE INDEX "time_logs_task_id_idx" ON "time_logs"("task_id");
CREATE INDEX "time_logs_tenant_id_end_time_idx" ON "time_logs"("tenant_id", "end_time");
CREATE INDEX "time_logs_tenant_id_start_time_idx" ON "time_logs"("tenant_id", "start_time");
CREATE INDEX "time_logs_tenant_id_is_paused_end_time_idx" ON "time_logs"("tenant_id", "is_paused", "end_time");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
