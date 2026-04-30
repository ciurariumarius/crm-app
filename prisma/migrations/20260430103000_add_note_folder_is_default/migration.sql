-- Add default marker to folders
ALTER TABLE "note_folders" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Index for fast default-folder lookup per tenant
CREATE INDEX "note_folders_tenant_id_is_default_idx" ON "note_folders"("tenant_id", "is_default");

-- Backfill: mark "General" folders as default
UPDATE "note_folders"
SET "is_default" = true
WHERE lower(trim("name")) = 'general';

-- Keep only one default folder per tenant (oldest wins)
UPDATE "note_folders"
SET "is_default" = false
WHERE "id" IN (
  SELECT f1."id"
  FROM "note_folders" f1
  WHERE f1."is_default" = true
    AND EXISTS (
      SELECT 1
      FROM "note_folders" f2
      WHERE f2."tenant_id" = f1."tenant_id"
        AND f2."is_default" = true
        AND (
          f2."created_at" < f1."created_at"
          OR (f2."created_at" = f1."created_at" AND f2."id" < f1."id")
        )
    )
);

-- Ensure a default folder exists for tenants that already have notes
WITH tenant_user AS (
  SELECT n."tenant_id" AS tenant_id, MIN(u."id") AS user_id
  FROM "notes" n
  JOIN "users" u ON u."tenant_id" = n."tenant_id"
  GROUP BY n."tenant_id"
)
INSERT INTO "note_folders" ("id", "tenant_id", "user_id", "name", "is_default", "created_at", "updated_at")
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  tu.tenant_id,
  tu.user_id,
  'General',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM tenant_user tu
WHERE tu.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "note_folders" f
    WHERE f."tenant_id" = tu.tenant_id
      AND f."is_default" = true
  );
