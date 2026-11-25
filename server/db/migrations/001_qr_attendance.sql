-- QR attendance. Paste into the Neon SQL Editor ONCE on a database built from the
-- earlier schema.sql. Keeps all existing data. (schema.sql already includes this.)
BEGIN;

-- Each employee gets a random, unguessable code for their QR (existing employees get one too).
ALTER TABLE employees ADD COLUMN qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid();

-- One row per successful scan. First scan of the day = 'in', the next = 'out', and so on.
CREATE TABLE attendance_log (
    log_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id  INT         NOT NULL
        REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    log_type     VARCHAR(3)  NOT NULL CHECK (log_type IN ('in', 'out')),
    scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attendance_log_employee ON attendance_log(employee_id, scanned_at);
CREATE INDEX idx_attendance_log_time     ON attendance_log(scanned_at);

COMMIT;
