-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "paid_at" DATETIME,
    "current_fee" DECIMAL,
    "closed_at" DATETIME,
    "closed_month_key" TEXT,
    "is_heavy_revenue_month" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_tenant_id_site_id_fkey" FOREIGN KEY ("tenant_id", "site_id") REFERENCES "sites" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt") SELECT "createdAt", "current_fee", "description", "id", "name", "paid_at", "payment_status", "site_id", "status", "tenant_id", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX "projects_site_id_idx" ON "projects"("site_id");
CREATE INDEX "projects_tenant_id_site_id_idx" ON "projects"("tenant_id", "site_id");
CREATE INDEX "projects_tenant_id_createdAt_idx" ON "projects"("tenant_id", "createdAt");
CREATE INDEX "projects_tenant_id_updatedAt_idx" ON "projects"("tenant_id", "updatedAt");
CREATE INDEX "projects_tenant_id_status_createdAt_idx" ON "projects"("tenant_id", "status", "createdAt");
CREATE INDEX "projects_tenant_id_payment_status_createdAt_idx" ON "projects"("tenant_id", "payment_status", "createdAt");
CREATE INDEX "projects_tenant_id_current_fee_idx" ON "projects"("tenant_id", "current_fee");
CREATE INDEX "projects_tenant_id_status_updatedAt_idx" ON "projects"("tenant_id", "status", "updatedAt");
CREATE INDEX "projects_tenant_id_payment_status_updatedAt_idx" ON "projects"("tenant_id", "payment_status", "updatedAt");
CREATE INDEX "projects_tenant_id_closed_month_key_idx" ON "projects"("tenant_id", "closed_month_key");
CREATE INDEX "projects_tenant_id_is_heavy_revenue_month_closed_month_key_idx" ON "projects"("tenant_id", "is_heavy_revenue_month", "closed_month_key");
CREATE INDEX "projects_tenant_id_status_closed_at_idx" ON "projects"("tenant_id", "status", "closed_at");
CREATE UNIQUE INDEX "projects_tenant_id_id_key" ON "projects"("tenant_id", "id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
