import { Router } from 'express'
import { db } from '../db.js'
import { requireRole } from '../auth.js'
import { HOURS_SQL, MANILA_DAY, PAYSLIP_SQL, WEEKLY_PERIODS_SQL } from '../payroll.js'

export const admin = Router()
admin.use(requireRole('admin'))

// Trimmed string from the request body; '' when missing or not a string.
const text = (v) => (typeof v === 'string' ? v.trim() : '')
const STATUSES = ['regular', 'probationary', 'contractual']
const DATE = /^\d{4}-\d{2}-\d{2}$/


// Unique-constraint name (Postgres default naming) -> message for the form.
const DUPLICATE = {
  department_department_code_key: 'A department with this code already exists.',
  department_department_name_key: 'A department with this name already exists.',
  employees_employee_no_key: 'This employee no. is already used.',
  employees_sss_no_key: 'This SSS no. is already registered to another employee.',
  employees_philhealth_no_key: 'This PhilHealth no. is already registered to another employee.',
  employees_pagibig_no_key: 'This Pag-IBIG no. is already registered to another employee.',
  employees_tin_key: 'This TIN is already registered to another employee.',
  app_user_email_key: 'This email already has a portal account.',
  wage_rate_effective_date_key: 'A daily wage already starts on this date. Pick another date.',
  deduction_type_deduction_name_key: 'This deduction type already exists.',
  earning_type_earning_name_key: 'This earning type already exists.',
}

// Turns DB errors caused by bad input into a 4xx; anything else stays a 500.
function sendDbError(res, err) {
  if (err.code === '23505') return res.status(409).json({ error: DUPLICATE[err.constraint] ?? 'This record already exists.' })
  if (err.code === '23503') return res.status(400).json({ error: 'Choose a department from the list.' })
  if (err.code === '22001') return res.status(400).json({ error: 'One of the fields is too long.' })
  if (err.code === '22007' || err.code === '22008') return res.status(400).json({ error: 'One of the dates is not a valid date.' })
  if (err.code === '23514' && err.constraint?.startsWith('chk_time'))
    return res.status(400).json({ error: 'Set both the start and end time, or leave both blank.' })
  throw err
}

admin.get('/departments', async (req, res) => {
  const { rows } = await db.query(`
    SELECT d.department_id AS id, d.department_code, d.department_name, d.is_active,
           to_char(d.time_in_start, 'HH24:MI') AS time_in_start, to_char(d.time_in_end, 'HH24:MI') AS time_in_end,
           to_char(d.time_out_start, 'HH24:MI') AS time_out_start, to_char(d.time_out_end, 'HH24:MI') AS time_out_end,
           COUNT(e.employee_id)::int AS employees
      FROM department d LEFT JOIN employees e USING (department_id)
     GROUP BY d.department_id
     ORDER BY d.department_name`)
  res.json(rows)
})

admin.post('/departments', async (req, res) => {
  const code = text(req.body?.department_code).toUpperCase()
  const name = text(req.body?.department_name)
  if (!code || !name) return res.status(400).json({ error: 'Enter a department code and name.' })
  try {
    const { rows } = await db.query(
      `INSERT INTO department (department_code, department_name) VALUES ($1, $2)
       RETURNING department_id AS id, department_code, department_name`,
      [code, name],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    sendDbError(res, err)
  }
})

// Edits a department: code, name, and when its employees may scan (blank start+end = anytime).
admin.patch('/departments/:id', async (req, res) => {
  const id = Number(req.params.id)
  const code = text(req.body?.department_code).toUpperCase()
  const name = text(req.body?.department_name)
  const keys = ['time_in_start', 'time_in_end', 'time_out_start', 'time_out_end']
  const times = keys.map((k) => text(req.body?.[k]) || null)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Department not found.' })
  if (!code || !name) return res.status(400).json({ error: 'Enter a department code and name.' })
  if (times.some((t) => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
    return res.status(400).json({ error: 'Enter times like 08:00.' })
  try {
    const { rowCount } = await db.query(
      `UPDATE department SET department_code = $1, department_name = $2,
              ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}
        WHERE department_id = $7`,
      [code, name, ...times, id],
    )
    if (!rowCount) return res.status(404).json({ error: 'Department not found.' })
    res.sendStatus(204)
  } catch (err) {
    sendDbError(res, err)
  }
})

admin.delete('/departments/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const { rowCount } = await db.query('DELETE FROM department WHERE department_id = $1', [Number.isInteger(id) ? id : 0])
    if (!rowCount) return res.status(404).json({ error: 'This department was already deleted.' })
    res.sendStatus(204)
  } catch (err) {
    // 23001 = blocked by ON DELETE RESTRICT (employees.department_id), 23503 = other foreign keys
    if (err.code === '23001' || err.code === '23503')
      return res.status(409).json({ error: 'This department still has employees. Move them to another department first.' })
    throw err
  }
})

admin.get('/employees', async (req, res) => {
  const { rows } = await db.query(`
    SELECT e.employee_id AS id, e.employee_no, e.first_name, e.middle_name, e.last_name,
           e.position, d.department_name, e.employment_status, e.date_hired, e.is_active
      FROM employees e JOIN department d USING (department_id)
     ORDER BY e.last_name, e.first_name`)
  res.json(rows)
})

// One employee, for the QR card and the edit form.
admin.get('/employees/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Employee not found.' })
  const { rows } = await db.query(
    `SELECT e.employee_id AS id, e.employee_no, e.first_name, e.middle_name, e.last_name,
            e.position, e.department_id, d.department_name, e.employment_status, e.date_hired,
            e.contact_no, e.sss_no, e.philhealth_no, e.pagibig_no, e.tin, e.is_active, e.qr_token
       FROM employees e JOIN department d USING (department_id)
      WHERE e.employee_id = $1`,
    [id],
  )
  if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
  res.json(rows[0])
})

// Employee fields from the register/edit form. Returns { e } or { error } for the form.
function readEmployee(b = {}) {
  const optional = (v) => text(v) || null
  const e = {
    employee_no: text(b.employee_no).toUpperCase(),
    first_name: text(b.first_name),
    middle_name: optional(b.middle_name),
    last_name: text(b.last_name),
    position: text(b.position),
    department_id: Number(b.department_id),
    employment_status: text(b.employment_status),
    date_hired: text(b.date_hired),
    contact_no: optional(b.contact_no),
    sss_no: optional(b.sss_no),
    philhealth_no: optional(b.philhealth_no),
    pagibig_no: optional(b.pagibig_no),
    tin: optional(b.tin),
  }
  if (!e.employee_no || !e.first_name || !e.last_name || !e.position)
    return { error: 'Fill in employee no., first name, last name and position.' }
  if (!Number.isInteger(e.department_id)) return { error: 'Choose a department from the list.' }
  if (!STATUSES.includes(e.employment_status)) return { error: 'Choose an employment status.' }
  if (!DATE.test(e.date_hired)) return { error: 'Enter the date hired.' }
  return { e }
}

// Registers an employee and, when an email is given, their portal login, in one transaction.
admin.post('/employees', async (req, res) => {
  const { e, error } = readEmployee(req.body)
  if (error) return res.status(400).json({ error })
  const email = text(req.body?.email).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email for the portal login.' })
  if (email && password.length < 8) return res.status(400).json({ error: 'The portal password needs at least 8 characters.' })

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const cols = Object.keys(e)
    const { rows } = await client.query(
      `INSERT INTO employees (${cols.join(', ')})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING employee_id AS id, employee_no`,
      Object.values(e),
    )
    if (email) {
      await client.query(
        `INSERT INTO app_user (email, password_hash, role, employee_id)
         VALUES ($1, crypt($2, gen_salt('bf', 10)), 'employee', $3)`,
        [email, password, rows[0].id],
      )
    }
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    sendDbError(res, err)
  } finally {
    client.release()
  }
})

admin.put('/employees/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { e, error } = readEmployee(req.body)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Employee not found.' })
  if (error) return res.status(400).json({ error })
  e.is_active = req.body?.is_active !== false
  const cols = Object.keys(e)
  try {
    const { rowCount } = await db.query(
      `UPDATE employees SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE employee_id = $${cols.length + 1}`,
      [...Object.values(e), id],
    )
    if (!rowCount) return res.status(404).json({ error: 'Employee not found.' })
    res.sendStatus(204)
  } catch (err) {
    sendDbError(res, err)
  }
})

// Deletes an employee and their portal login. Refused once they have attendance or payslips,
// because that would erase payroll history; mark them inactive instead.
admin.delete('/employees/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'This employee was already deleted.' })
  const { rows } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM attendance_log WHERE employee_id = $1)
         OR EXISTS (SELECT 1 FROM salary WHERE employee_id = $1) AS has_history`,
    [id],
  )
  if (rows[0].has_history)
    return res.status(409).json({
      error: 'This employee has attendance or payslips, so deleting would erase payroll history. Edit them and uncheck Active instead.',
    })
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM app_user WHERE employee_id = $1', [id])
    const { rowCount } = await client.query('DELETE FROM employees WHERE employee_id = $1', [id])
    await client.query('COMMIT')
    if (!rowCount) return res.status(404).json({ error: 'This employee was already deleted.' })
    res.sendStatus(204)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

// Scans on one Philippine calendar day (?date=YYYY-MM-DD), newest first.
admin.get('/attendance', async (req, res) => {
  const date = text(req.query.date)
  if (!DATE.test(date)) return res.status(400).json({ error: 'Choose a date.' })
  try {
    const { rows } = await db.query(
      `SELECT l.log_id AS id, l.log_type, l.scanned_at, e.employee_no,
              e.first_name || ' ' || e.last_name AS name, d.department_name
         FROM attendance_log l
         JOIN employees e USING (employee_id)
         JOIN department d USING (department_id)
        WHERE ${MANILA_DAY} = $1::date
        ORDER BY l.scanned_at DESC`,
      [date],
    )
    res.json(rows)
  } catch (err) {
    sendDbError(res, err)
  }
})

// Edits one visit on one day: sets its time in, and its time out (blank = no time out).
// Missing scans are created, so a forgotten time out can be filled in.
// shortcut: time out must be the same day as time in; handle night shifts when needed.
admin.put('/attendance', async (req, res) => {
  const b = req.body ?? {}
  const date = text(b.date)
  const timeIn = text(b.time_in)
  const timeOut = text(b.time_out)
  const inId = b.in_id == null ? null : Number(b.in_id)
  const outId = b.out_id == null ? null : Number(b.out_id)
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!DATE.test(date) || !HHMM.test(timeIn) || (timeOut && !HHMM.test(timeOut)))
    return res.status(400).json({ error: 'Enter the time in, and the time out if any, like 08:00.' })
  if (timeOut && timeOut <= timeIn) return res.status(400).json({ error: 'Time out must be later than time in.' })
  if ([inId, outId].some((id) => id !== null && !Number.isInteger(id)))
    return res.status(400).json({ error: 'Choose the attendance to edit.' })

  const locked = await db.query(
    `SELECT 1 FROM payroll_period WHERE $1::date BETWEEN period_start AND period_end AND status <> 'open'`,
    [date],
  )
  if (locked.rowCount)
    return res.status(409).json({ error: "This week's payroll is already processed, so its attendance can't change." })
  const emp = (await db.query('SELECT employee_id FROM employees WHERE employee_no = $1', [text(b.employee_no)])).rows[0]
  if (!emp) return res.status(404).json({ error: 'Employee not found.' })

  const at = (hhmm) => `${date} ${hhmm}+08` // Philippine time
  // Each change only touches this employee's scan of the right type.
  const set = (id, type, hhmm) =>
    id
      ? client.query(
          'UPDATE attendance_log SET scanned_at = $1 WHERE log_id = $2 AND employee_id = $3 AND log_type = $4',
          [at(hhmm), id, emp.employee_id, type],
        )
      : client.query('INSERT INTO attendance_log (employee_id, log_type, scanned_at) VALUES ($1, $2, $3)', [
          emp.employee_id,
          type,
          at(hhmm),
        ])
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const changed = [await set(inId, 'in', timeIn), timeOut ? await set(outId, 'out', timeOut) : null]
    if ((inId && !changed[0].rowCount) || (timeOut && outId && !changed[1].rowCount)) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'This attendance changed meanwhile. Reload the page and try again.' })
    }
    if (!timeOut && outId)
      await client.query("DELETE FROM attendance_log WHERE log_id = $1 AND employee_id = $2 AND log_type = 'out'", [
        outId,
        emp.employee_id,
      ])
    await client.query('COMMIT')
    res.sendStatus(204)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

// Deletes scans (one visit = its time in and time out). Scans in a processed or released
// week are locked so pay already given to employees can't change underneath them.
admin.delete('/attendance', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : []
  if (!ids.length || ids.length > 2 || !ids.every(Number.isInteger))
    return res.status(400).json({ error: 'Choose the attendance to delete.' })
  const locked = await db.query(
    `SELECT 1 FROM attendance_log l JOIN payroll_period p
         ON ${MANILA_DAY} BETWEEN p.period_start AND p.period_end
      WHERE l.log_id = ANY($1::int[]) AND p.status <> 'open' LIMIT 1`,
    [ids],
  )
  if (locked.rowCount)
    return res.status(409).json({ error: "This week's payroll is already processed, so its attendance can't be deleted." })
  const { rowCount } = await db.query('DELETE FROM attendance_log WHERE log_id = ANY($1::int[])', [ids])
  if (!rowCount) return res.status(404).json({ error: 'This attendance was already deleted.' })
  res.json({ deleted: rowCount })
})

admin.get('/wage-rates', async (req, res) => {
  const { rows } = await db.query(
    'SELECT wage_rate_id AS id, daily_rate, effective_date, remarks FROM wage_rate ORDER BY effective_date DESC',
  )
  res.json(rows)
})

// A new daily wage is a new row from its start date; old rows stay so past payslips keep their rate.
admin.post('/wage-rates', async (req, res) => {
  const rate = String(req.body?.daily_rate ?? '').trim()
  const date = text(req.body?.effective_date)
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(rate) || Number(rate) <= 0)
    return res.status(400).json({ error: 'Enter a daily wage above 0, like 475 or 475.50.' })
  if (!DATE.test(date)) return res.status(400).json({ error: 'Enter the date this wage starts.' })
  try {
    const { rows } = await db.query(
      `INSERT INTO wage_rate (daily_rate, effective_date, remarks) VALUES ($1, $2, $3)
       RETURNING wage_rate_id AS id, daily_rate, effective_date, remarks`,
      [rate, date, text(req.body?.remarks) || null],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    sendDbError(res, err)
  }
})

admin.get('/periods/:id/hours', async (req, res) => {
  const id = Number(req.params.id)
  const period = Number.isInteger(id)
    ? (await db.query(
        `SELECT payroll_period_id AS id, period_start, period_end, pay_date, status,
                (SELECT row_to_json(r) FROM (
                   SELECT daily_rate, effective_date FROM wage_rate
                    WHERE effective_date <= p.period_end ORDER BY effective_date DESC LIMIT 1) r) AS rate
           FROM payroll_period p WHERE payroll_period_id = $1`,
        [id],
      )).rows[0]
    : null
  if (!period) return res.status(404).json({ error: 'Payroll period not found.' })
  const { rows } = await db.query(HOURS_SQL, [id])
  res.json({ period, rows })
})

// Writes the hours above into payslips (salary rows). Only while the period is open,
// so processed/released payslips never change underneath employees.
admin.post('/periods/:id/generate', async (req, res) => {
  const id = Number(req.params.id)
  const period = Number.isInteger(id)
    ? (await db.query('SELECT status FROM payroll_period WHERE payroll_period_id = $1', [id])).rows[0]
    : null
  if (!period) return res.status(404).json({ error: 'Payroll period not found.' })
  if (period.status !== 'open') return res.status(409).json({ error: 'This period is already processed. Payslips can only be saved while it is open.' })
  const { rowCount } = await db.query(
    `INSERT INTO salary (employee_id, payroll_period_id, wage_rate_id, days_worked)
     SELECT employee_id, $1, wage_rate_id, days_worked FROM (${HOURS_SQL}) h
     ON CONFLICT ON CONSTRAINT uq_salary_employee_period
     DO UPDATE SET wage_rate_id = EXCLUDED.wage_rate_id, days_worked = EXCLUDED.days_worked`,
    [id],
  )
  res.json({ saved: rowCount })
})

admin.get('/periods', async (req, res) => {
  await db.query(WEEKLY_PERIODS_SQL) // no manual setup: this week's period always exists
  const { rows } = await db.query(`
    SELECT p.payroll_period_id AS id, p.period_start, p.period_end, p.pay_date, p.status,
           COUNT(v.salary_id)::int       AS payslips,
           COALESCE(SUM(v.gross_pay), 0) AS gross_pay,
           COALESCE(SUM(v.total_deductions), 0) AS total_deductions,
           COALESCE(SUM(v.net_pay), 0)   AS net_pay
      FROM payroll_period p LEFT JOIN v_payslip v USING (payroll_period_id)
     GROUP BY p.payroll_period_id
     ORDER BY p.period_start DESC`)
  res.json(rows)
})

// One payslip with its lines, for the printable view.
// All payslips of a week (optionally one department), with their lines, to print together.
admin.get('/payslip-sheets', async (req, res) => {
  const period = Number(req.query.period)
  if (!Number.isInteger(period)) return res.status(400).json({ error: 'Choose a payroll period.' })
  const { rows } = await db.query(
    `${PAYSLIP_SQL} WHERE v.payroll_period_id = $1 AND ($2::text = '' OR v.department_name = $2::text)
      ORDER BY v.department_name, v.employee_name`,
    [period, text(req.query.dept)],
  )
  res.json(rows)
})

admin.get('/payslips/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { rows } = Number.isInteger(id) ? await db.query(`${PAYSLIP_SQL} WHERE v.salary_id = $1`, [id]) : { rows: [] }
  if (!rows[0]) return res.status(404).json({ error: 'Payslip not found.' })
  res.json(rows[0])
})

// Deletes one payslip (its earning/deduction lines go with it). Only while the week is open,
// so payslips already given to employees never disappear.
admin.delete('/payslips/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!(await payslipIsOpen(res, id))) return
  await db.query('DELETE FROM salary WHERE salary_id = $1', [id])
  res.sendStatus(204)
})

admin.get('/deduction-types', async (req, res) => {
  const { rows } = await db.query(
    'SELECT deduction_type_id AS id, deduction_name, is_government FROM deduction_type ORDER BY deduction_name',
  )
  res.json(rows)
})

admin.post('/deduction-types', async (req, res) => {
  const name = text(req.body?.deduction_name)
  if (!name) return res.status(400).json({ error: 'Enter a name for the deduction type.' })
  try {
    const { rows } = await db.query(
      `INSERT INTO deduction_type (deduction_name, is_government) VALUES ($1, $2)
       RETURNING deduction_type_id AS id, deduction_name, is_government`,
      [name, req.body?.is_government === true],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    sendDbError(res, err)
  }
})

admin.get('/earning-types', async (req, res) => {
  const { rows } = await db.query(
    'SELECT earning_type_id AS id, earning_name, is_taxable FROM earning_type ORDER BY earning_name',
  )
  res.json(rows)
})

admin.post('/earning-types', async (req, res) => {
  const name = text(req.body?.earning_name)
  if (!name) return res.status(400).json({ error: 'Enter a name for the earning type.' })
  try {
    const { rows } = await db.query(
      `INSERT INTO earning_type (earning_name, is_taxable) VALUES ($1, $2)
       RETURNING earning_type_id AS id, earning_name, is_taxable`,
      [name, req.body?.is_taxable === true],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    sendDbError(res, err)
  }
})

// Payslip lines can change only while the week is open. Sends the error and returns false otherwise.
async function payslipIsOpen(res, id) {
  const found = Number.isInteger(id)
    ? (await db.query(
        'SELECT p.status FROM salary s JOIN payroll_period p USING (payroll_period_id) WHERE s.salary_id = $1',
        [id],
      )).rows[0]
    : null
  if (!found) res.status(404).json({ error: 'Payslip not found.' })
  else if (found.status !== 'open')
    res.status(409).json({ error: "This week's payroll is already processed, so its payslips can't change." })
  return found?.status === 'open'
}

// Earning and deduction lines on a payslip follow the same rules.
const LINES = {
  earnings: { table: 'earning', typeCol: 'earning_type_id', unique: 'uq_earning', noun: 'earning' },
  deductions: { table: 'deduction', typeCol: 'deduction_type_id', unique: 'uq_deduction', noun: 'deduction' },
}

// Applies one change to a payslip's lines, undone if net pay would drop below zero.
// Returns { rowCount, net_pay }, or null after sending the error.
async function changeLines(res, salaryId, sql, params) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(sql, params)
    const net = (await client.query('SELECT net_pay FROM v_payslip WHERE salary_id = $1', [salaryId])).rows[0].net_pay
    if (Number(net) < 0) {
      await client.query('ROLLBACK')
      res.status(400).json({ error: 'Net pay would go below zero. Lower the deductions first.' })
      return null
    }
    await client.query('COMMIT')
    return { rowCount, net_pay: net }
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23503') {
      res.status(400).json({ error: 'Choose a type from the list.' })
      return null
    }
    throw err
  } finally {
    client.release()
  }
}

// Adds an earning or deduction to a payslip, or changes its amount if that type is already there.
admin.post('/payslips/:id/:kind', async (req, res) => {
  const line = LINES[req.params.kind]
  if (!line) return res.sendStatus(404)
  const id = Number(req.params.id)
  const typeId = Number(req.body?.type_id)
  const amount = String(req.body?.amount ?? '').trim()
  if (!Number.isInteger(typeId)) return res.status(400).json({ error: `Choose a ${line.noun} type.` })
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: 'Enter an amount above 0, like 150 or 150.50.' })
  if (!(await payslipIsOpen(res, id))) return
  const done = await changeLines(
    res,
    id,
    `INSERT INTO ${line.table} (salary_id, ${line.typeCol}, amount) VALUES ($1, $2, $3)
     ON CONFLICT ON CONSTRAINT ${line.unique} DO UPDATE SET amount = EXCLUDED.amount`,
    [id, typeId, amount],
  )
  if (done) res.status(201).json({ net_pay: done.net_pay })
})

admin.delete('/payslips/:id/:kind/:typeId', async (req, res) => {
  const line = LINES[req.params.kind]
  if (!line) return res.sendStatus(404)
  const id = Number(req.params.id)
  if (!(await payslipIsOpen(res, id))) return
  const done = await changeLines(
    res,
    id,
    `DELETE FROM ${line.table} WHERE salary_id = $1 AND ${line.typeCol} = $2`,
    [id, Number(req.params.typeId) || 0],
  )
  if (!done) return
  if (!done.rowCount) return res.status(404).json({ error: `This ${line.noun} was already removed.` })
  res.sendStatus(204)
})

admin.get('/payslips', async (req, res) => {
  const period = Number(req.query.period)
  if (!Number.isInteger(period)) return res.status(400).json({ error: 'Choose a payroll period.' })
  const { rows } = await db.query(
    'SELECT * FROM v_payslip WHERE payroll_period_id = $1 ORDER BY employee_name',
    [period],
  )
  res.json(rows)
})
