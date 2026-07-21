-- Five source CRM task labels intentionally include one trailing space. The CRM
-- importer compares these labels exactly, so preserve that whitespace in both
-- the selectable catalog and previously recorded work-entry snapshots.
WITH "exact_names"("normalized_name", "exact_name") AS (
    VALUES
        ('debriefing client - ca urmare a auditului', 'Debriefing client - ca urmare a auditului '),
        ('followup la tracking - ca urmare a debriefing-ului', 'Followup la tracking - ca urmare a debriefing-ului '),
        ('meeting / videocall client', 'Meeting / videocall client '),
        ('meeting / videocall intern', 'Meeting / videocall intern '),
        ('setare tracking - alte sisteme de advertising', 'Setare tracking - alte sisteme de advertising ')
)
UPDATE "lms_work_tasks"
SET
    "name" = (
        SELECT "exact_names"."exact_name"
        FROM "exact_names"
        WHERE "exact_names"."normalized_name" = "lms_work_tasks"."normalized_name"
    ),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "normalized_name" IN (SELECT "normalized_name" FROM "exact_names");

WITH "exact_names"("normalized_name", "exact_name") AS (
    VALUES
        ('debriefing client - ca urmare a auditului', 'Debriefing client - ca urmare a auditului '),
        ('followup la tracking - ca urmare a debriefing-ului', 'Followup la tracking - ca urmare a debriefing-ului '),
        ('meeting / videocall client', 'Meeting / videocall client '),
        ('meeting / videocall intern', 'Meeting / videocall intern '),
        ('setare tracking - alte sisteme de advertising', 'Setare tracking - alte sisteme de advertising ')
)
UPDATE "lms_work_entries"
SET
    "task_name_snapshot" = (
        SELECT "exact_names"."exact_name"
        FROM "exact_names"
        WHERE "exact_names"."normalized_name" = lower(trim("lms_work_entries"."task_name_snapshot"))
    ),
    "updated_at" = CURRENT_TIMESTAMP
WHERE lower(trim("task_name_snapshot")) IN (SELECT "normalized_name" FROM "exact_names");
