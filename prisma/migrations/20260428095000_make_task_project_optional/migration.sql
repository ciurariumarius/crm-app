-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "urgency" TEXT NOT NULL DEFAULT 'Normal',
    "deadline" DATETIME,
    "estimated_minutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_tenant_id_project_id_fkey" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_tasks" (
    "id",
    "tenant_id",
    "project_id",
    "name",
    "description",
    "status",
    "urgency",
    "deadline",
    "estimated_minutes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "tenant_id",
    "project_id",
    "name",
    "description",
    "status",
    "urgency",
    "deadline",
    "estimated_minutes",
    "createdAt",
    "updatedAt"
FROM "tasks";

DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";

CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_tenant_id_project_id_idx" ON "tasks"("tenant_id", "project_id");
CREATE INDEX "tasks_tenant_id_project_id_status_idx" ON "tasks"("tenant_id", "project_id", "status");
CREATE INDEX "tasks_tenant_id_createdAt_idx" ON "tasks"("tenant_id", "createdAt");
CREATE INDEX "tasks_tenant_id_updatedAt_idx" ON "tasks"("tenant_id", "updatedAt");
CREATE INDEX "tasks_tenant_id_name_idx" ON "tasks"("tenant_id", "name");
CREATE INDEX "tasks_tenant_id_status_deadline_idx" ON "tasks"("tenant_id", "status", "deadline");
CREATE INDEX "tasks_tenant_id_status_createdAt_idx" ON "tasks"("tenant_id", "status", "createdAt");
CREATE INDEX "tasks_tenant_id_urgency_deadline_idx" ON "tasks"("tenant_id", "urgency", "deadline");
CREATE UNIQUE INDEX "tasks_tenant_id_id_key" ON "tasks"("tenant_id", "id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
