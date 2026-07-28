ALTER TABLE "notes" ADD COLUMN "deleted_at" DATETIME;
ALTER TABLE "notes" ADD COLUMN "has_checklist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notes" ADD COLUMN "has_attachment" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "notes_deleted_at_updated_at_idx"
ON "notes"("deleted_at", "updated_at");

UPDATE "notes"
SET "has_checklist" = true
WHERE
  "content" LIKE '%data-type="taskList"%'
  OR "content" LIKE '%data-type=''taskList''%';

UPDATE "notes"
SET "has_attachment" = true
WHERE "content" LIKE '%<img %';

ALTER TABLE "note_folders"
ADD COLUMN "parent_id" TEXT
REFERENCES "note_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "note_folders"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 1000;

CREATE INDEX "note_folders_parent_id_sort_order_idx"
ON "note_folders"("parent_id", "sort_order");

CREATE TABLE "note_tags" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "note_tags_normalized_name_key"
ON "note_tags"("normalized_name");

CREATE INDEX "note_tags_name_idx"
ON "note_tags"("name");

CREATE TABLE "note_tag_assignments" (
  "note_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("note_id", "tag_id"),
  CONSTRAINT "note_tag_assignments_note_id_fkey"
    FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "note_tag_assignments_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "note_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "note_tag_assignments_tag_id_note_id_idx"
ON "note_tag_assignments"("tag_id", "note_id");

CREATE TABLE "note_smart_folders" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "match_mode" TEXT NOT NULL DEFAULT 'all',
  "require_pinned" BOOLEAN,
  "require_checklist" BOOLEAN,
  "require_attachment" BOOLEAN,
  "updated_within_days" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 1000,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "note_smart_folders_name_key"
ON "note_smart_folders"("name");

CREATE INDEX "note_smart_folders_sort_order_idx"
ON "note_smart_folders"("sort_order");

CREATE TABLE "note_smart_folder_tags" (
  "smart_folder_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  PRIMARY KEY ("smart_folder_id", "tag_id"),
  CONSTRAINT "note_smart_folder_tags_smart_folder_id_fkey"
    FOREIGN KEY ("smart_folder_id") REFERENCES "note_smart_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "note_smart_folder_tags_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "note_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "note_smart_folder_tags_tag_id_smart_folder_id_idx"
ON "note_smart_folder_tags"("tag_id", "smart_folder_id");
