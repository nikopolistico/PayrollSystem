export const MANILA_DAY = `(l.scanned_at AT TIME ZONE 'Asia/Manila')::date`

// Hours rendered per employee in payroll period $1, from QR scans.
// Each 'in' pairs with the next scan that day if it is an 'out'. Paid hours are capped at
// 8 per day (an unscanned lunch hour is not paid as extra); pay = paid hours / 8 x daily rate.
// basic_pay uses the same rounding as v_payslip, so the saved payslip shows the same amount.
export const HOURS_SQL = `
  WITH p AS (SELECT period_start, period_end FROM payroll_period WHERE payroll_period_id = $1),
  rate AS (
    SELECT w.wage_rate_id, w.daily_rate FROM wage_rate w, p
     WHERE w.effective_date <= p.period_end ORDER BY w.effective_date DESC LIMIT 1),
  scans AS (
    SELECT l.employee_id, l.log_type, l.scanned_at, ${MANILA_DAY} AS work_date,
           LEAD(l.log_type) OVER w AS next_type, LEAD(l.scanned_at) OVER w AS next_at
      FROM attendance_log l, p
     WHERE ${MANILA_DAY} BETWEEN p.period_start AND p.period_end
    WINDOW w AS (PARTITION BY l.employee_id, ${MANILA_DAY} ORDER BY l.scanned_at)),
  per_day AS (
    SELECT employee_id, work_date,
           SUM(EXTRACT(EPOCH FROM next_at - scanned_at) / 3600) FILTER (WHERE next_type = 'out') AS hours,
           COUNT(*) FILTER (WHERE next_type IS DISTINCT FROM 'out') AS missing_out
      FROM scans WHERE log_type = 'in'
     GROUP BY employee_id, work_date),
  per_emp AS (
    SELECT employee_id, COUNT(hours)::int AS days_present,
           COALESCE(SUM(hours), 0) AS hours, COALESCE(SUM(LEAST(COALESCE(hours, 0), 8)), 0) AS paid_hours,
           SUM(missing_out)::int AS missing_out
      FROM per_day GROUP BY employee_id)
  SELECT e.employee_id, e.employee_no, e.first_name || ' ' || e.last_name AS name, d.department_name,
         x.days_present, ROUND(x.hours, 2) AS hours_rendered, ROUND(x.paid_hours, 2) AS paid_hours,
         x.missing_out, r.wage_rate_id, r.daily_rate,
         ROUND(x.paid_hours / 8, 4) AS days_worked,
         ROUND(ROUND(x.paid_hours / 8, 4) * r.daily_rate, 2) AS basic_pay
    FROM per_emp x
    JOIN employees e USING (employee_id)
    JOIN department d USING (department_id)
    CROSS JOIN rate r
   ORDER BY d.department_name, e.last_name, e.first_name`

// Weekly pay: each period runs Sunday to Saturday and is paid on Saturday (all Philippine dates).
// Creates this week's period plus any missed weeks back to the first QR scan. A week that would
// overlap an existing period is skipped, so the same hours can never land in two periods.
export const WEEKLY_PERIODS_SQL = `
  INSERT INTO payroll_period (period_start, period_end, pay_date)
  SELECT w.s, w.s + 6, w.s + 6
    FROM (SELECT (now() AT TIME ZONE 'Asia/Manila')::date AS today,
                 (SELECT MIN(${MANILA_DAY}) FROM attendance_log l) AS first_scan) x,
         LATERAL (SELECT LEAST(x.first_scan, x.today) AS d) f, -- LEAST skips NULL (no scans yet)
         LATERAL generate_series(f.d - EXTRACT(DOW FROM f.d)::int,
                                 x.today - EXTRACT(DOW FROM x.today)::int,
                                 interval '7 days') AS g(ts),
         LATERAL (SELECT g.ts::date AS s) w
   WHERE NOT EXISTS (SELECT 1 FROM payroll_period p WHERE p.period_start <= w.s + 6 AND p.period_end >= w.s)
  ON CONFLICT ON CONSTRAINT uq_period DO NOTHING`

// A payslip with its earning/deduction lines and the employee's position.
// Callers add the WHERE (and ORDER BY); the employee portal and the admin print view share it.
export const PAYSLIP_SQL = `
  SELECT v.*, p.status, e.position,
         COALESCE((SELECT json_agg(json_build_object('type_id', t.earning_type_id, 'name', t.earning_name, 'amount', x.amount) ORDER BY t.earning_name)
                     FROM earning x JOIN earning_type t USING (earning_type_id)
                    WHERE x.salary_id = v.salary_id), '[]') AS earnings,
         COALESCE((SELECT json_agg(json_build_object('type_id', t.deduction_type_id, 'name', t.deduction_name, 'amount', x.amount) ORDER BY t.deduction_name)
                     FROM deduction x JOIN deduction_type t USING (deduction_type_id)
                    WHERE x.salary_id = v.salary_id), '[]') AS deductions
    FROM v_payslip v
    JOIN salary s USING (salary_id)
    JOIN employees e ON e.employee_id = s.employee_id
    JOIN payroll_period p ON p.payroll_period_id = v.payroll_period_id`
