PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_time_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
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

INSERT INTO "new_time_logs" (
    "createdAt",
    "description",
    "duration_seconds",
    "end_time",
    "id",
    "is_paused",
    "project_id",
    "source",
    "start_time",
    "task_id"
)
SELECT
    "createdAt",
    "description",
    "duration_seconds",
    "end_time",
    "id",
    "is_paused",
    "project_id",
    "source",
    "start_time",
    "task_id"
FROM "time_logs";

DROP TABLE "time_logs";
ALTER TABLE "new_time_logs" RENAME TO "time_logs";

CREATE INDEX "time_logs_project_id_idx" ON "time_logs"("project_id");
CREATE INDEX "time_logs_task_id_idx" ON "time_logs"("task_id");
CREATE INDEX "time_logs_end_time_idx" ON "time_logs"("end_time");
CREATE INDEX "time_logs_start_time_idx" ON "time_logs"("start_time");
CREATE INDEX "time_logs_is_paused_end_time_idx" ON "time_logs"("is_paused", "end_time");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
