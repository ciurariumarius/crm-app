PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Deleted and archived notes are intentionally removed. Remove their tag joins first
-- because the notes table is rebuilt with foreign-key enforcement temporarily disabled.
DELETE FROM "note_tag_assignments"
WHERE "note_id" IN (
  SELECT "id"
  FROM "notes"
  WHERE "deleted_at" IS NOT NULL OR "archived" = 1
);

DROP TABLE IF EXISTS "note_drawings";

CREATE TABLE "new_note_folders" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "parent_id" TEXT,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 1000,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "note_folders_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "note_folders" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_note_folders" (
  "id", "parent_id", "name", "sort_order", "created_at", "updated_at"
)
SELECT "id", "parent_id", "name", "sort_order", "created_at", "updated_at"
FROM "note_folders";

DROP TABLE "note_folders";
ALTER TABLE "new_note_folders" RENAME TO "note_folders";
CREATE UNIQUE INDEX "note_folders_name_key" ON "note_folders"("name");
CREATE INDEX "note_folders_parent_id_sort_order_idx" ON "note_folders"("parent_id", "sort_order");
CREATE INDEX "note_folders_created_at_idx" ON "note_folders"("created_at");

CREATE TABLE "new_notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "folder_id" TEXT,
  "title" TEXT NOT NULL DEFAULT 'Untitled',
  "content" TEXT NOT NULL DEFAULT '',
  "content_text" TEXT NOT NULL DEFAULT '',
  "content_revision" INTEGER NOT NULL DEFAULT 0,
  "has_checklist" BOOLEAN NOT NULL DEFAULT false,
  "has_attachment" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "notes_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "note_folders" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_notes" (
  "id", "folder_id", "title", "content", "content_text",
  "content_revision", "has_checklist", "has_attachment", "createdAt", "updatedAt"
)
SELECT
  "id", "folder_id", "title", "content", "content_text",
  0, "has_checklist", "has_attachment", "createdAt", "updatedAt"
FROM "notes"
WHERE "deleted_at" IS NULL AND "archived" = 0;

DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
CREATE INDEX "notes_folder_id_updated_at_idx" ON "notes"("folder_id", "updatedAt");
CREATE INDEX "notes_updated_at_idx" ON "notes"("updatedAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
