CREATE TABLE "note_drawings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note_id" TEXT,
    "project_id" TEXT,
    "task_id" TEXT,
    "stroke_data" TEXT NOT NULL,
    "preview_path" TEXT NOT NULL,
    "canvas_width" INTEGER NOT NULL,
    "canvas_height" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "note_drawings_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "note_drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "note_drawings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "note_drawings_exactly_one_owner_check" CHECK (
        ("note_id" IS NOT NULL) +
        ("project_id" IS NOT NULL) +
        ("task_id" IS NOT NULL) = 1
    )
);

CREATE INDEX "note_drawings_note_id_idx" ON "note_drawings"("note_id");
CREATE INDEX "note_drawings_project_id_idx" ON "note_drawings"("project_id");
CREATE INDEX "note_drawings_task_id_idx" ON "note_drawings"("task_id");
CREATE INDEX "note_drawings_updated_at_idx" ON "note_drawings"("updated_at");
