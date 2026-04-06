-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" TEXT NOT NULL DEFAULT '',
    "content_text" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notes_tenant_id_idx" ON "notes"("tenant_id");

-- CreateIndex
CREATE INDEX "notes_tenant_id_user_id_idx" ON "notes"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "notes_tenant_id_archived_updatedAt_idx" ON "notes"("tenant_id", "archived", "updatedAt");

-- CreateIndex
CREATE INDEX "notes_tenant_id_pinned_updatedAt_idx" ON "notes"("tenant_id", "pinned", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notes_tenant_id_id_key" ON "notes"("tenant_id", "id");
