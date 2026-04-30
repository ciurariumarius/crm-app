-- CreateTable
CREATE TABLE "note_folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "note_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "note_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "content" TEXT NOT NULL DEFAULT '',
    "content_text" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "note_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_notes" ("archived", "content", "content_text", "createdAt", "id", "pinned", "tenant_id", "title", "updatedAt", "user_id")
SELECT "archived", "content", "content_text", "createdAt", "id", "pinned", "tenant_id", "title", "updatedAt", "user_id" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
CREATE UNIQUE INDEX "notes_tenant_id_id_key" ON "notes"("tenant_id", "id");
CREATE INDEX "notes_tenant_id_idx" ON "notes"("tenant_id");
CREATE INDEX "notes_tenant_id_user_id_idx" ON "notes"("tenant_id", "user_id");
CREATE INDEX "notes_tenant_id_folder_id_updatedAt_idx" ON "notes"("tenant_id", "folder_id", "updatedAt");
CREATE INDEX "notes_tenant_id_archived_updatedAt_idx" ON "notes"("tenant_id", "archived", "updatedAt");
CREATE INDEX "notes_tenant_id_pinned_updatedAt_idx" ON "notes"("tenant_id", "pinned", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "note_folders_tenant_id_name_key" ON "note_folders"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "note_folders_tenant_id_user_id_idx" ON "note_folders"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "note_folders_tenant_id_created_at_idx" ON "note_folders"("tenant_id", "created_at");
