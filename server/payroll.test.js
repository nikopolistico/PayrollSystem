// Pay math against the real database, inside a transaction that is always rolled back.
// Skipped when DATABASE_URL is not set.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { HOURS_SQL } from './payroll.js'

// Close the shared DB pool once, after every test here has used it.
after(async () => {
  if (process.env.DATABASE_URL) await (await import('./db.js')).db.end()
})

test('hours rendered and pay per employee', { skip: !process.env.DATABASE_URL }, async () => {
  const { db } = await import('./db.js')
  const c = await db.connect()
  const at = (day, hhmm) => `2026-12-${day} ${hhmm}+08` // Manila time
  try {
    await c.query('BEGIN')
    const dept = (await c.query(
      `INSERT INTO department (department_code, department_name) VALUES ('ZZT', 'ZZ Test') RETURNING department_id`,
    )).rows[0].department_id
    const hire = async (no) => (await c.query(
      `INSERT INTO employees (employee_no, first_name, last_name, position, department_id, employment_status, date_hired)
       VALUES ($1, $1, 'T', 'X', $2, 'regular', '2026-01-01') RETURNING employee_id`,
      [no, dept],
    )).rows[0].employee_id
    const scan = (id, type, ts) =>
      c.query('INSERT INTO attendance_log (employee_id, log_type, scanned_at) VALUES ($1, $2, $3)', [id, type, ts])
    await c.query(`INSERT INTO wage_rate (daily_rate, effective_date) VALUES (475, '2026-11-30')`)

    const a = await hire('ZZA') // 6h day, 9h day (capped at 8), a day with no time out
    await scan(a, 'in', at('01', '08:00')); await scan(a, 'out', at('01', '14:00'))
    await scan(a, 'in', at('02', '08:00')); await scan(a, 'out', at('02', '17:00'))
    await scan(a, 'in', at('03', '08:00'))
    const b = await hire('ZZB') // split shift 4h + 3.5h, plus a day outside the period
    await scan(b, 'in', at('01', '08:00')); await scan(b, 'out', at('01', '12:00'))
    await scan(b, 'in', at('01', '13:00')); await scan(b, 'out', at('01', '16:30'))
    await scan(b, 'in', at('20', '08:00')); await scan(b, 'out', at('20', '17:00'))

    const period = (await c.query(
      `INSERT INTO payroll_period (period_start, period_end, pay_date)
       VALUES ('2026-12-01', '2026-12-15', '2026-12-16') RETURNING payroll_period_id`,
    )).rows[0].payroll_period_id
    const rows = (await c.query(HOURS_SQL, [period])).rows
    const pick = (no) => {
      const r = rows.find((x) => x.employee_no === no)
      return [r.days_present, r.hours_rendered, r.paid_hours, r.missing_out, r.basic_pay]
    }
    assert.deepEqual(pick('ZZA'), [2, '15.00', '14.00', 1, '831.25']) // 14 h = 1.75 days x 475
    assert.deepEqual(pick('ZZB'), [1, '7.50', '7.50', 0, '445.31']) // 7.5/8 x 475 = 445.3125
  } finally {
    await c.query('ROLLBACK')
    c.release()
  }
})

test('weekly periods: Sunday to Saturday, paid Saturday, created once', { skip: !process.env.DATABASE_URL }, async () => {
  const { db } = await import('./db.js')
  const c = await db.connect()
  try {
    await c.query('BEGIN')
    await c.query('DELETE FROM salary') // test-only, rolled back: start from no periods
    await c.query('DELETE FROM payroll_period')
    const { WEEKLY_PERIODS_SQL } = await import('./payroll.js')
    await c.query(WEEKLY_PERIODS_SQL)
    const again = await c.query(WEEKLY_PERIODS_SQL)
    assert.equal(again.rowCount, 0) // second run adds nothing

    const { rows } = await c.query(
      `SELECT EXTRACT(DOW FROM period_start)::int AS start_dow, EXTRACT(DOW FROM period_end)::int AS end_dow,
              pay_date = period_end AS paid_on_end,
              (now() AT TIME ZONE 'Asia/Manila')::date BETWEEN period_start AND period_end AS is_this_week
         FROM payroll_period ORDER BY period_start`,
    )
    assert.ok(rows.length >= 1)
    for (const r of rows) assert.deepEqual([r.start_dow, r.end_dow, r.paid_on_end], [0, 6, true])
    assert.equal(rows.at(-1).is_this_week, true)
  } finally {
    await c.query('ROLLBACK')
    c.release()
  }
})
