-- Add persistent tenant-wide ordering for the work-entry task catalog.
ALTER TABLE "lms_work_tasks" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 1000;

CREATE INDEX "lms_work_tasks_tenant_id_sort_order_idx"
ON "lms_work_tasks"("tenant_id", "sort_order");

-- Add the task choices extracted from the source CRM. Existing matching tasks
-- are kept, so this migration is safe when part of the catalog was added manually.
WITH "defaults"("name", "normalized_name", "sort_order") AS (
    VALUES
        ('Acces in platforme', 'acces in platforme', 0),
        ('Audit tracking', 'audit tracking', 1),
        ('Comunicare client / coleg - email / telefon', 'comunicare client / coleg - email / telefon', 2),
        ('Creare GA4 / GTM', 'creare ga4 / gtm', 3),
        ('Debriefing client - ca urmare a auditului', 'debriefing client - ca urmare a auditului', 4),
        ('Dezvoltare', 'dezvoltare', 5),
        ('Followup la tracking - ca urmare a debriefing-ului', 'followup la tracking - ca urmare a debriefing-ului', 6),
        ('Meeting / videocall client', 'meeting / videocall client', 7),
        ('Meeting / videocall intern', 'meeting / videocall intern', 8),
        ('Modificari in contul de GTM', 'modificari in contul de gtm', 9),
        ('Reverificare tracking', 'reverificare tracking', 10),
        ('Setare server side tracking', 'setare server side tracking', 11),
        ('Setare tracking - alte sisteme de advertising', 'setare tracking - alte sisteme de advertising', 12),
        ('Setare tracking facebook ads', 'setare tracking facebook ads', 13),
        ('Setare tracking google ads', 'setare tracking google ads', 14),
        ('Setare tracking google analitics', 'setare tracking google analitics', 15),
        ('Setare tracking tiktok ads', 'setare tracking tiktok ads', 16),
        ('Task-uri administrative', 'task-uri administrative', 17),
        ('Training intern', 'training intern', 18),
        ('Verificare / Setare / Modificare cookie consent', 'verificare / setare / modificare cookie consent', 19)
)
INSERT OR IGNORE INTO "lms_work_tasks" (
    "id",
    "tenant_id",
    "name",
    "normalized_name",
    "is_active",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    lower(
        hex(randomblob(4)) || '-' ||
        hex(randomblob(2)) || '-' ||
        '4' || substr(hex(randomblob(2)), 2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
        hex(randomblob(6))
    ),
    tenant."id",
    defaults."name",
    defaults."normalized_name",
    true,
    defaults."sort_order",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tenants" AS tenant
CROSS JOIN "defaults" AS defaults;

-- Apply the source order to matching tasks that already existed.
WITH "defaults"("normalized_name", "sort_order") AS (
    VALUES
        ('acces in platforme', 0),
        ('audit tracking', 1),
        ('comunicare client / coleg - email / telefon', 2),
        ('creare ga4 / gtm', 3),
        ('debriefing client - ca urmare a auditului', 4),
        ('dezvoltare', 5),
        ('followup la tracking - ca urmare a debriefing-ului', 6),
        ('meeting / videocall client', 7),
        ('meeting / videocall intern', 8),
        ('modificari in contul de gtm', 9),
        ('reverificare tracking', 10),
        ('setare server side tracking', 11),
        ('setare tracking - alte sisteme de advertising', 12),
        ('setare tracking facebook ads', 13),
        ('setare tracking google ads', 14),
        ('setare tracking google analitics', 15),
        ('setare tracking tiktok ads', 16),
        ('task-uri administrative', 17),
        ('training intern', 18),
        ('verificare / setare / modificare cookie consent', 19)
)
UPDATE "lms_work_tasks"
SET "sort_order" = (
    SELECT defaults."sort_order"
    FROM "defaults" AS defaults
    WHERE defaults."normalized_name" = "lms_work_tasks"."normalized_name"
)
WHERE "normalized_name" IN (SELECT "normalized_name" FROM "defaults");
