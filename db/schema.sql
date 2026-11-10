-- =====================================================================
--  RCJA GROUP PAYROLL SYSTEM — PostgreSQL schema (3NF), Render edition
--  Companies: ECRJ Farm, Conjen, Caraga Eagles, RCJA Business Center,
--             RCJA Powerfuel, RCJA Laundry
--  Target: Render PostgreSQL (PostgreSQL 15+)
--  Run once on an empty database:  npm run sql -- db/schema.sql
--  (or paste into pgAdmin / DBeaver / psql connected to Render).
--
--  Relationships:
--    company 1─< department 1─< employee >─1 position
--    employee 1─< employee_rate | attendance | employee_loan | payslip
--    company 1─< payroll_period 1─< payslip >─1 employee_rate
--    payslip 1─< payslip_earning   >─1 earning_type
--    payslip 1─< payslip_deduction >─1 deduction_type
--    payslip_deduction >─0..1 employee_loan
--    app_user >─0..1 employee                     (login accounts)
-- =====================================================================

BEGIN;

-- crypt() / gen_salt() for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ORGANIZATION
-- ---------------------------------------------------------------------

CREATE TABLE company (
    company_id      SERIAL PRIMARY KEY,
    company_code    VARCHAR(10)  NOT NULL UNIQUE,
    company_name    VARCHAR(100) NOT NULL UNIQUE,
    address         VARCHAR(255),
    tin             VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE department (
    department_id   SERIAL PRIMARY KEY,
    company_id      INT NOT NULL REFERENCES company(company_id),
    department_name VARCHAR(100) NOT NULL,
    UNIQUE (company_id, department_name)
);

CREATE TABLE position (
    position_id     SERIAL PRIMARY KEY,
    position_title  VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 2. EMPLOYEES
--    company is NOT stored here: department -> company already
-- ---------------------------------------------------------------------

CREATE TABLE employee (
    employee_id     SERIAL PRIMARY KEY,
    employee_no     VARCHAR(20)  NOT NULL UNIQUE,
    first_name      VARCHAR(50)  NOT NULL,
    middle_name     VARCHAR(50),
    last_name       VARCHAR(50)  NOT NULL,
    birth_date      DATE,
    contact_no      VARCHAR(20),
    address         VARCHAR(255),
    department_id   INT NOT NULL REFERENCES department(department_id),
    position_id     INT NOT NULL REFERENCES position(position_id),
    employment_type VARCHAR(20) NOT NULL
        CHECK (employment_type IN ('REGULAR','PROBATIONARY','CONTRACTUAL','PART_TIME')),
    date_hired      DATE NOT NULL,
    date_separated  DATE,
    sss_no          VARCHAR(20),
    philhealth_no   VARCHAR(20),
    pagibig_no      VARCHAR(20),
    tin             VARCHAR(20),
    CHECK (date_separated IS NULL OR date_separated >= date_hired)
);

-- Rate history: a raise is a new row, so old payslips stay correct
CREATE TABLE employee_rate (
    rate_id         SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employee(employee_id),
    rate_type       VARCHAR(10) NOT NULL CHECK (rate_type IN ('DAILY','MONTHLY','HOURLY')),
    rate_amount     NUMERIC(12,2) NOT NULL CHECK (rate_amount > 0),
    effective_from  DATE NOT NULL,
    UNIQUE (employee_id, effective_from)
);

-- ---------------------------------------------------------------------
-- 3. ATTENDANCE (DTR) — hours worked are derived, not stored
-- ---------------------------------------------------------------------

CREATE TABLE attendance (
    attendance_id   SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employee(employee_id),
    work_date       DATE NOT NULL,
    time_in         TIME,
    time_out        TIME,
    break_minutes   INT NOT NULL DEFAULT 60 CHECK (break_minutes >= 0),
    remarks         VARCHAR(100),
    UNIQUE (employee_id, work_date)
);

CREATE TABLE holiday (
    holiday_id      SERIAL PRIMARY KEY,
    holiday_date    DATE NOT NULL UNIQUE,
    holiday_name    VARCHAR(100) NOT NULL,
    holiday_type    VARCHAR(20) NOT NULL CHECK (holiday_type IN ('REGULAR','SPECIAL'))
);

-- ---------------------------------------------------------------------
-- 4. PAYROLL
-- ---------------------------------------------------------------------

CREATE TABLE payroll_period (
    period_id       SERIAL PRIMARY KEY,
    company_id      INT NOT NULL REFERENCES company(company_id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    pay_date        DATE NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN','PROCESSED','PAID','CLOSED')),
    CHECK (period_end >= period_start),
    UNIQUE (company_id, period_start, period_end)
);

CREATE TABLE earning_type (
    earning_type_id SERIAL PRIMARY KEY,
    earning_name    VARCHAR(50) NOT NULL UNIQUE,
    is_taxable      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE deduction_type (
    deduction_type_id SERIAL PRIMARY KEY,
    deduction_name    VARCHAR(50) NOT NULL UNIQUE,
    is_statutory      BOOLEAN NOT NULL DEFAULT FALSE
);

-- One payslip per employee per period. Totals come from v_payslip_summary.
CREATE TABLE payslip (
    payslip_id      SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES payroll_period(period_id),
    employee_id     INT NOT NULL REFERENCES employee(employee_id),
    rate_id         INT NOT NULL REFERENCES employee_rate(rate_id),
    days_worked     NUMERIC(5,2) NOT NULL DEFAULT 0,
    UNIQUE (period_id, employee_id)
);

CREATE TABLE payslip_earning (
    payslip_id      INT NOT NULL REFERENCES payslip(payslip_id) ON DELETE CASCADE,
    earning_type_id INT NOT NULL REFERENCES earning_type(earning_type_id),
    hours           NUMERIC(6,2),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (payslip_id, earning_type_id)
);

-- Loans and cash advances (balance is derived from payments)
CREATE TABLE employee_loan (
    loan_id             SERIAL PRIMARY KEY,
    employee_id         INT NOT NULL REFERENCES employee(employee_id),
    deduction_type_id   INT NOT NULL REFERENCES deduction_type(deduction_type_id),
    principal_amount    NUMERIC(12,2) NOT NULL CHECK (principal_amount > 0),
    amortization        NUMERIC(12,2) NOT NULL CHECK (amortization > 0),
    date_granted        DATE NOT NULL
);

CREATE TABLE payslip_deduction (
    payslip_deduction_id SERIAL PRIMARY KEY,
    payslip_id        INT NOT NULL REFERENCES payslip(payslip_id) ON DELETE CASCADE,
    deduction_type_id INT NOT NULL REFERENCES deduction_type(deduction_type_id),
    loan_id           INT REFERENCES employee_loan(loan_id),
    amount            NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    -- NULLS NOT DISTINCT: without it, two 'SSS' rows (loan_id NULL) on one payslip were allowed
    UNIQUE NULLS NOT DISTINCT (payslip_id, deduction_type_id, loan_id)
);

-- ---------------------------------------------------------------------
-- 5. LOGIN ACCOUNTS
--    Each account is an admin or an employee. Employee accounts point at
--    their employee row; admins may or may not be employees.
--    password_hash is bcrypt via pgcrypto; never store plain passwords.
-- ---------------------------------------------------------------------

CREATE TABLE app_user (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash TEXT NOT NULL,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('admin','employee')),
    employee_id   INT UNIQUE REFERENCES employee(employee_id),
    CHECK (role = 'admin' OR employee_id IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- 6. INTEGRITY RULES 3NF alone can't express
-- ---------------------------------------------------------------------

-- A payslip's employee must belong to the same company as the period,
-- and its rate must be that employee's rate.
CREATE FUNCTION trg_payslip_check() RETURNS trigger AS $$
BEGIN
    IF (SELECT d.company_id FROM employee e
          JOIN department d ON d.department_id = e.department_id
         WHERE e.employee_id = NEW.employee_id)
       <> (SELECT company_id FROM payroll_period WHERE period_id = NEW.period_id) THEN
        RAISE EXCEPTION 'Employee % is not in the company of payroll period %',
            NEW.employee_id, NEW.period_id;
    END IF;
    IF (SELECT employee_id FROM employee_rate WHERE rate_id = NEW.rate_id) <> NEW.employee_id THEN
        RAISE EXCEPTION 'Rate % does not belong to employee %', NEW.rate_id, NEW.employee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payslip_check
BEFORE INSERT OR UPDATE ON payslip
FOR EACH ROW EXECUTE FUNCTION trg_payslip_check();

-- A loan payment must be for a loan of the same employee and same deduction type.
CREATE FUNCTION trg_payslip_deduction_check() RETURNS trigger AS $$
BEGIN
    IF NEW.loan_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM employee_loan l
          JOIN payslip ps ON ps.payslip_id = NEW.payslip_id
         WHERE l.loan_id = NEW.loan_id
           AND l.employee_id = ps.employee_id
           AND l.deduction_type_id = NEW.deduction_type_id) THEN
        RAISE EXCEPTION 'Loan % does not match the employee or deduction type of payslip %',
            NEW.loan_id, NEW.payslip_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payslip_deduction_check
BEFORE INSERT OR UPDATE ON payslip_deduction
FOR EACH ROW EXECUTE FUNCTION trg_payslip_deduction_check();

CREATE INDEX idx_employee_department ON employee(department_id);
CREATE INDEX idx_attendance_date     ON attendance(work_date);
CREATE INDEX idx_payslip_employee    ON payslip(employee_id);
CREATE INDEX idx_loan_employee       ON employee_loan(employee_id);
CREATE INDEX idx_deduction_loan      ON payslip_deduction(loan_id);

-- ---------------------------------------------------------------------
-- 7. VIEWS (derived values live here, not in tables)
--    Access control (admin sees all, employee sees own) is done by the
--    API server in server/index.js — the browser never talks to the DB.
-- ---------------------------------------------------------------------

CREATE VIEW v_employee AS
SELECT e.employee_id, e.employee_no,
       e.last_name || ', ' || e.first_name AS full_name,
       c.company_name, d.department_name, p.position_title,
       e.employment_type, e.date_hired
FROM employee e
JOIN department d ON d.department_id = e.department_id
JOIN company    c ON c.company_id    = d.company_id
JOIN position   p ON p.position_id   = e.position_id;

-- Overnight shifts (time_out < time_in) are not handled and give negative hours.
CREATE VIEW v_attendance_hours AS
SELECT a.*,
       ROUND((EXTRACT(EPOCH FROM (a.time_out - a.time_in)) / 3600
              - a.break_minutes / 60.0)::numeric, 2) AS hours_worked
FROM attendance a
WHERE a.time_in IS NOT NULL AND a.time_out IS NOT NULL;

CREATE VIEW v_payslip_summary AS
SELECT ps.payslip_id, ps.employee_id, pp.period_start, pp.period_end, pp.pay_date,
       c.company_name, d.department_name, e.employee_no,
       e.last_name || ', ' || e.first_name AS full_name,
       COALESCE(earn.total, 0) AS gross_pay,
       COALESCE(ded.total, 0)  AS total_deductions,
       COALESCE(earn.total, 0) - COALESCE(ded.total, 0) AS net_pay
FROM payslip ps
JOIN payroll_period pp ON pp.period_id = ps.period_id
JOIN company    c ON c.company_id    = pp.company_id
JOIN employee   e ON e.employee_id   = ps.employee_id
JOIN department d ON d.department_id = e.department_id
LEFT JOIN (SELECT payslip_id, SUM(amount) total FROM payslip_earning   GROUP BY payslip_id) earn
       ON earn.payslip_id = ps.payslip_id
LEFT JOIN (SELECT payslip_id, SUM(amount) total FROM payslip_deduction GROUP BY payslip_id) ded
       ON ded.payslip_id = ps.payslip_id;

CREATE VIEW v_loan_balance AS
SELECT l.loan_id, l.employee_id, dt.deduction_name, l.principal_amount,
       COALESCE(SUM(pd.amount), 0) AS total_paid,
       l.principal_amount - COALESCE(SUM(pd.amount), 0) AS balance
FROM employee_loan l
JOIN deduction_type dt ON dt.deduction_type_id = l.deduction_type_id
LEFT JOIN payslip_deduction pd ON pd.loan_id = l.loan_id
GROUP BY l.loan_id, dt.deduction_name;

CREATE VIEW v_company_payroll_total AS
SELECT company_name, period_start, period_end,
       COUNT(*)              AS employees_paid,
       SUM(gross_pay)        AS total_gross,
       SUM(total_deductions) AS total_deductions,
       SUM(net_pay)          AS total_net
FROM v_payslip_summary
GROUP BY company_name, period_start, period_end;

-- ---------------------------------------------------------------------
-- 8. SEED DATA
-- ---------------------------------------------------------------------

INSERT INTO company (company_code, company_name) VALUES
('ECRJ',   'ECRJ Farm'),
('CONJEN', 'Conjen'),
('CEGS',   'Caraga Eagles'),
('RCJABC', 'RCJA Business Center'),
('RCJAPF', 'RCJA Powerfuel'),
('RCJALH', 'RCJA Laundry');

-- Starter departments (rename or add to fit each business)
INSERT INTO department (company_id, department_name)
SELECT company_id, dept FROM company
CROSS JOIN (VALUES ('Administration'), ('Operations')) v(dept);

INSERT INTO earning_type (earning_name, is_taxable) VALUES
('Basic Pay', TRUE), ('Overtime', TRUE), ('Regular Holiday Pay', TRUE),
('Special Holiday Pay', TRUE), ('Night Differential', TRUE),
('Allowance', FALSE), ('13th Month Pay', FALSE);

INSERT INTO deduction_type (deduction_name, is_statutory) VALUES
('SSS', TRUE), ('PhilHealth', TRUE), ('Pag-IBIG', TRUE), ('Withholding Tax', TRUE),
('Cash Advance', FALSE), ('SSS Loan', FALSE), ('Pag-IBIG Loan', FALSE),
('Late / Undertime', FALSE);

COMMIT;

-- =====================================================================
--  AFTER RUNNING: create login accounts — edit db/create-users.sql,
--  then run:  npm run sql -- db/create-users.sql
-- =====================================================================
