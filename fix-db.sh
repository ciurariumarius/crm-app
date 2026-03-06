#!/bin/bash
DB_FILE="/home/populatia-crm/htdocs/crm.populatia.ro/dev.db"
sqlite3 "$DB_FILE" "ALTER TABLE tasks ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE projects ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE partners ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE sites ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE service_library ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE time_logs ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE project_rollovers ADD COLUMN tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default-tenant';" || true
sqlite3 "$DB_FILE" "ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT 'default-tenant';" || true

sqlite3 "$DB_FILE" "UPDATE tasks SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;"
sqlite3 "$DB_FILE" "UPDATE projects SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;"
sqlite3 "$DB_FILE" "UPDATE partners SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;"
