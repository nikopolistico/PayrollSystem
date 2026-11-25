-- Pay by hours rendered: days_worked = paid hours / 8 needs 4 decimals
-- (7.5 h = 0.9375 days; with 2 decimals it rounded to 0.94 and overpaid).
-- Paste into the Neon SQL Editor ONCE (after 002). Keeps all data.
BEGIN;

DROP VIEW v_payslip; -- the view uses the column, so it is recreated unchanged below
ALTER TABLE salary ALTER COLUMN days_worked TYPE NUMERIC(8,4);

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

COMMIT;
