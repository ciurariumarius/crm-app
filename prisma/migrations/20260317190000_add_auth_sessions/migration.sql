-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "remember_device" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" DATETIME NOT NULL,
    "max_session_expires_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "auth_sessions_tenant_id_user_id_revoked_at_idx" ON "auth_sessions"("tenant_id", "user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_tenant_id_expires_at_idx" ON "auth_sessions"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_tenant_id_max_session_expires_at_idx" ON "auth_sessions"("tenant_id", "max_session_expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
