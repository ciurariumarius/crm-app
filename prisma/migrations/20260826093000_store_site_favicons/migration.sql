ALTER TABLE "sites" ADD COLUMN "favicon_data" BLOB;
ALTER TABLE "sites" ADD COLUMN "favicon_mime_type" TEXT;
ALTER TABLE "sites" ADD COLUMN "favicon_hash" TEXT;
ALTER TABLE "sites" ADD COLUMN "favicon_updated_at" DATETIME;

CREATE INDEX "sites_created_at_idx" ON "sites"("createdAt");
