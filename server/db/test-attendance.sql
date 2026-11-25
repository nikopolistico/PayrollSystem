-- TEST DATA: 2 departments, 4 employees, attendance for the week Nov 22-28, 2026.
-- Paste into the Neon SQL Editor. Safe to re-run: it replaces these test employees' scans.
-- Remove it all with the CLEANUP block at the bottom.
BEGIN;

INSERT INTO department (department_code, department_name) VALUES
    ('TST-OPS', 'Test Operations'),
    ('TST-ADM', 'Test Admin')
ON CONFLICT DO NOTHING;

INSERT INTO employees (employee_no, first_name, last_name, position, department_id, employment_status, date_hired)
SELECT v.no, v.first_name, v.last_name, v.position, d.department_id, 'regular', '2026-01-05'
  FROM (VALUES
    ('TEST01', 'Ana',   'Santos', 'Farmhand',       'TST-OPS'),
    ('TEST02', 'Ben',   'Reyes',  'Pump attendant', 'TST-OPS'),
    ('TEST03', 'Carla', 'Lim',    'Cashier',        'TST-ADM'),
    ('TEST04', 'Dino',  'Cruz',   'Clerk',          'TST-ADM')
  ) v(no, first_name, last_name, position, dept)
  JOIN department d ON d.department_code = v.dept
ON CONFLICT (employee_no) DO NOTHING;

-- Start clean for these 4 so re-running does not double the scans
DELETE FROM attendance_log
 WHERE employee_id IN (SELECT employee_id FROM employees WHERE employee_no LIKE 'TEST0_');

-- Times are Philippine time (+08)
INSERT INTO attendance_log (employee_id, log_type, scanned_at)
SELECT e.employee_id, v.log_type, v.at::timestamptz
  FROM (VALUES
    -- Ana: 9h day (pays 8), 6h day (pays 6 = 356.25), on duty today
    ('TEST01', 'in',  '2026-11-23 08:00+08'), ('TEST01', 'out', '2026-11-23 17:00+08'),
    ('TEST01', 'in',  '2026-11-24 08:00+08'), ('TEST01', 'out', '2026-11-24 14:00+08'),
    ('TEST01', 'in',  '2026-11-25 07:58+08'),
    -- Ben: split shift with lunch scan (8h), long day 9h05m (pays 8), on duty today
    ('TEST02', 'in',  '2026-11-23 08:00+08'), ('TEST02', 'out', '2026-11-23 12:00+08'),
    ('TEST02', 'in',  '2026-11-23 13:00+08'), ('TEST02', 'out', '2026-11-23 17:00+08'),
    ('TEST02', 'in',  '2026-11-24 08:05+08'), ('TEST02', 'out', '2026-11-24 17:10+08'),
    ('TEST02', 'in',  '2026-11-25 08:10+08'),
    -- Carla: full 8h day, then a day with NO time out (counts 0, shows a warning), on duty today
    ('TEST03', 'in',  '2026-11-23 08:30+08'), ('TEST03', 'out', '2026-11-23 16:30+08'),
    ('TEST03', 'in',  '2026-11-24 08:00+08'),
    ('TEST03', 'in',  '2026-11-25 07:55+08'),
    -- Dino: Sunday half day 4h, Monday 6h30m
    ('TEST04', 'in',  '2026-11-22 08:00+08'), ('TEST04', 'out', '2026-11-22 12:00+08'),
    ('TEST04', 'in',  '2026-11-23 09:00+08'), ('TEST04', 'out', '2026-11-23 15:30+08')
  ) v(no, log_type, at)
  JOIN employees e ON e.employee_no = v.no;

COMMIT;

-- Expected on Payroll periods > Payroll summary (week Nov 22-28, daily wage 475):
--   Ana Santos   rendered 15.00  paid 14.00  P831.25
--   Ben Reyes    rendered 17.08  paid 16.00  P950.00
--   Carla Lim    rendered  8.00  paid  8.00  P475.00  (2 missing time out)
--   Dino Cruz    rendered 10.50  paid 10.50  P623.44
--   Total paid hours 48.50, basic pay P2,879.69
-- (Today's time ins without a time out also count as "missing time out" until they scan out.)


-- ============================== CLEANUP ==============================
-- Removes everything above (and any payslips saved for these employees).
-- Select from BEGIN to COMMIT below and run it.
--
-- BEGIN;
-- DELETE FROM salary         WHERE employee_id IN (SELECT employee_id FROM employees WHERE employee_no LIKE 'TEST0_');
-- DELETE FROM attendance_log WHERE employee_id IN (SELECT employee_id FROM employees WHERE employee_no LIKE 'TEST0_');
-- DELETE FROM app_user       WHERE employee_id IN (SELECT employee_id FROM employees WHERE employee_no LIKE 'TEST0_');
-- DELETE FROM employees      WHERE employee_no LIKE 'TEST0_';
-- DELETE FROM department     WHERE department_code IN ('TST-OPS', 'TST-ADM');
-- COMMIT;
