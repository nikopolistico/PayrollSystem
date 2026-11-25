-- Reference copy of the schema already run in the Neon SQL Editor.
-- To reset the database, paste this whole file into the Neon SQL Editor (safe to re-run).
BEGIN;

-- Clean slate so this file can be re-run. WARNING: deletes ALL payroll data and login accounts.
DROP VIEW  IF EXISTS v_payslip;
DROP TABLE IF EXISTS attendance_log, app_user, deduction, deduction_type, earning, earning_type,
                     salary, payroll_period, wage_rate, employees, department CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- crypt() / gen_salt() for password hashing (login accounts, section 10)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
--  RCJA PAYROLL SYSTEM — BCNF Schema (PostgreSQL)
--  Works in: Supabase SQL Editor, Neon SQL Editor, Nhost, plain Postgres
--  Daily wage: PHP 475.00
-- =====================================================================

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. DEPARTMENT
-- ---------------------------------------------------------------------
CREATE TABLE department (
    department_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_code  VARCHAR(20)  NOT NULL UNIQUE,
    department_name  VARCHAR(100) NOT NULL UNIQUE,
    -- when QR scans are allowed; NULL = anytime, start > end = crosses midnight
    time_in_start    TIME,
    time_in_end      TIME,
    time_out_start   TIME,
    time_out_end     TIME,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_in_pair  CHECK ((time_in_start  IS NULL) = (time_in_end  IS NULL)),
    CONSTRAINT chk_time_out_pair CHECK ((time_out_start IS NULL) = (time_out_end IS NULL))
);

-- ---------------------------------------------------------------------
-- 2. EMPLOYEES
-- ---------------------------------------------------------------------
CREATE TABLE employees (
    employee_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_no        VARCHAR(20)  NOT NULL UNIQUE,
    first_name         VARCHAR(50)  NOT NULL,
    middle_name        VARCHAR(50),
    last_name          VARCHAR(50)  NOT NULL,
    position           VARCHAR(100) NOT NULL,
    department_id      INT          NOT NULL
        REFERENCES department(department_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    employment_status  VARCHAR(20)  NOT NULL
        CHECK (employment_status IN ('regular', 'probationary', 'contractual')),
    date_hired         DATE         NOT NULL,
    contact_no         VARCHAR(15),
    sss_no             VARCHAR(20)  UNIQUE,
    philhealth_no      VARCHAR(20)  UNIQUE,
    pagibig_no         VARCHAR(20)  UNIQUE,
    tin                VARCHAR(20)  UNIQUE,
    -- random, unguessable code printed as the employee's attendance QR
    qr_token           UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_employees_department ON employees(department_id);

-- ---------------------------------------------------------------------
-- 3. WAGE_RATE  (add a new row when the rate changes; never edit old rows)
-- ---------------------------------------------------------------------
CREATE TABLE wage_rate (
    wage_rate_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    daily_rate      NUMERIC(10,2) NOT NULL CHECK (daily_rate > 0),
    effective_date  DATE          NOT NULL UNIQUE,
    remarks         VARCHAR(255),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. PAYROLL_PERIOD
-- ---------------------------------------------------------------------
CREATE TABLE payroll_period (
    payroll_period_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period_start       DATE        NOT NULL,
    period_end         DATE        NOT NULL,
    pay_date           DATE        NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'processed', 'released')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_period UNIQUE (period_start, period_end),
    CONSTRAINT chk_period CHECK (period_end >= period_start)
);

-- ---------------------------------------------------------------------
-- 5. SALARY  (one payslip per employee per payroll period)
-- ---------------------------------------------------------------------
CREATE TABLE salary (
    salary_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id        INT          NOT NULL
        REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    payroll_period_id  INT          NOT NULL
        REFERENCES payroll_period(payroll_period_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    wage_rate_id       INT          NOT NULL
        REFERENCES wage_rate(wage_rate_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- 4 decimals: days come from hours / 8 (e.g. 7.5 h = 0.9375 days); 2 decimals would misprice pay
    days_worked        NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (days_worked >= 0),
    overtime_hours     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_salary_employee_period UNIQUE (employee_id, payroll_period_id)
);
CREATE INDEX idx_salary_period ON salary(payroll_period_id);

-- ---------------------------------------------------------------------
-- 6. EARNING_TYPE  (allowances, bonuses)
-- ---------------------------------------------------------------------
CREATE TABLE earning_type (
    earning_type_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    earning_name     VARCHAR(50) NOT NULL UNIQUE,
    is_taxable       BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 7. EARNING
-- ---------------------------------------------------------------------
CREATE TABLE earning (
    earning_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    salary_id        INT           NOT NULL
        REFERENCES salary(salary_id) ON UPDATE CASCADE ON DELETE CASCADE,
    earning_type_id  INT           NOT NULL
        REFERENCES earning_type(earning_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    amount           NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    CONSTRAINT uq_earning UNIQUE (salary_id, earning_type_id)
);

-- ---------------------------------------------------------------------
-- 8. DEDUCTION_TYPE
-- ---------------------------------------------------------------------
CREATE TABLE deduction_type (
    deduction_type_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deduction_name     VARCHAR(50) NOT NULL UNIQUE,
    is_government      BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------
-- 9. DEDUCTION
-- ---------------------------------------------------------------------
CREATE TABLE deduction (
    deduction_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    salary_id          INT           NOT NULL
        REFERENCES salary(salary_id) ON UPDATE CASCADE ON DELETE CASCADE,
    deduction_type_id  INT           NOT NULL
        REFERENCES deduction_type(deduction_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    amount             NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    remarks            VARCHAR(255),
    CONSTRAINT uq_deduction UNIQUE (salary_id, deduction_type_id)
);

-- updated_at triggers
CREATE TRIGGER trg_department_updated BEFORE UPDATE ON department
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_salary_updated BEFORE UPDATE ON salary
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- SEED DATA
-- =====================================================================
INSERT INTO wage_rate (daily_rate, effective_date, remarks)
VALUES (475.00, '2026-01-01', 'Standard daily rate');

INSERT INTO deduction_type (deduction_name, is_government) VALUES
    ('SSS',             TRUE),
    ('PhilHealth',      TRUE),
    ('Pag-IBIG',        TRUE),
    ('Withholding Tax', TRUE),
    ('Cash Advance',    FALSE),
    ('Loan',            FALSE),
    ('Late/Undertime',  FALSE),
    ('Others',          FALSE);

INSERT INTO earning_type (earning_name, is_taxable) VALUES
    ('Rice Allowance',     FALSE),
    ('Holiday Pay',        TRUE),
    ('Night Differential', TRUE),
    ('Bonus',              TRUE);

-- =====================================================================
-- VIEW: computed payslip (derived values are NOT stored -> BCNF)
--   basic_pay    = days_worked * daily_rate
--   overtime_pay = overtime_hours * (daily_rate / 8) * 1.25
--   net_pay      = gross_pay - total_deductions
-- =====================================================================
CREATE VIEW v_payslip AS
WITH base AS (
    SELECT
        s.salary_id,
        e.employee_no,
        e.last_name || ', ' || e.first_name                     AS employee_name,
        d.department_name,
        p.payroll_period_id,
        p.period_start,
        p.period_end,
        p.pay_date,
        w.daily_rate,
        s.days_worked,
        s.overtime_hours,
        ROUND(s.days_worked * w.daily_rate, 2)                  AS basic_pay,
        ROUND(s.overtime_hours * (w.daily_rate / 8) * 1.25, 2)  AS overtime_pay,
        COALESCE((SELECT SUM(amount) FROM earning   x WHERE x.salary_id = s.salary_id), 0) AS other_earnings,
        COALESCE((SELECT SUM(amount) FROM deduction x WHERE x.salary_id = s.salary_id), 0) AS total_deductions
    FROM salary s
    JOIN employees      e ON e.employee_id       = s.employee_id
    JOIN department     d ON d.department_id     = e.department_id
    JOIN payroll_period p ON p.payroll_period_id = s.payroll_period_id
    JOIN wage_rate      w ON w.wage_rate_id      = s.wage_rate_id
)
SELECT
    *,
    basic_pay + overtime_pay + other_earnings                    AS gross_pay,
    basic_pay + overtime_pay + other_earnings - total_deductions AS net_pay
FROM base;

-- ---------------------------------------------------------------------
-- 10. APP_USER  (login accounts; admins may or may not be employees)
--     password_hash is bcrypt via pgcrypto; never store plain passwords.
-- ---------------------------------------------------------------------
CREATE TABLE app_user (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash  TEXT         NOT NULL,
    role           VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'employee')),
    employee_id    INT UNIQUE
        REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CHECK (role = 'admin' OR employee_id IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- 11. ATTENDANCE_LOG  (one row per successful QR scan;
--     first scan of the day = 'in', the next = 'out', and so on)
-- ---------------------------------------------------------------------
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
