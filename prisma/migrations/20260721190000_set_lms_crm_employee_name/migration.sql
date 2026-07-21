-- The CRM import template requires this exact value in both Responsabil and
-- Executant. Update historical snapshots so entry history matches future exports.
UPDATE "lms_work_entries"
SET
    "employee_name_snapshot" = 'Marius Ciurariu',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "employee_name_snapshot" <> 'Marius Ciurariu';

