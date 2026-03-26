PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "profile_pic" TEXT,
    "password_hash" TEXT NOT NULL,
    "hourly_rate" DECIMAL DEFAULT 0,
    "timer_idle_pause_minutes" INTEGER DEFAULT 60,
    "timer_hard_cap_hours" INTEGER DEFAULT 3,
    "timer_reminder_interval_minutes" INTEGER DEFAULT 60,
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_users" (
    "id",
    "tenant_id",
    "username",
    "name",
    "profile_pic",
    "password_hash",
    "hourly_rate",
    "timer_idle_pause_minutes",
    "timer_hard_cap_hours",
    "timer_reminder_interval_minutes",
    "two_factor_secret",
    "two_factor_enabled",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "tenant_id",
    "username",
    "name",
    "profile_pic",
    "password_hash",
    "hourly_rate",
    CASE
        WHEN "timer_idle_pause_minutes" IS NULL OR "timer_idle_pause_minutes" = 15 THEN 60
        ELSE "timer_idle_pause_minutes"
    END,
    "timer_hard_cap_hours",
    "timer_reminder_interval_minutes",
    "two_factor_secret",
    "two_factor_enabled",
    "createdAt",
    "updatedAt"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
