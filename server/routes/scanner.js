import { Router } from 'express'
import { db } from '../db.js'
import { ampm, inWindow } from '../time.js'

// Public on purpose: the attendance portal opens from the login page without signing in.
// Only a valid employee QR (random UUID) can record a scan.
export const scanner = Router()

// Start of today in Philippine time, so "today" doesn't flip at 8 AM (UTC midnight).
// shortcut: a shift that crosses midnight counts as two days; handle night shifts when needed.
const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

scanner.get('/logs', async (req, res) => {
  const { rows } = await db.query(`
    SELECT l.log_id AS id, l.log_type, l.scanned_at, e.employee_no,
           e.first_name || ' ' || e.last_name AS name, d.department_name
      FROM attendance_log l
      JOIN employees e USING (employee_id)
      JOIN department d USING (department_id)
     WHERE l.scanned_at >= ${TODAY}
     ORDER BY l.scanned_at DESC
     LIMIT 200`)
  res.json(rows)
})

// Records one scan. The camera reads the same QR many times a second, so a repeat
// within a minute is reported as 'duplicate' and not saved again.
scanner.post('/scan', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!UUID.test(token)) return res.status(404).json({ error: 'This QR code is not an employee QR.' })

  const { rows } = await db.query(
    `SELECT e.employee_id, e.employee_no, e.first_name || ' ' || e.last_name AS name,
            d.department_name, e.is_active,
            to_char(d.time_in_start, 'HH24:MI') AS in_start, to_char(d.time_in_end, 'HH24:MI') AS in_end,
            to_char(d.time_out_start, 'HH24:MI') AS out_start, to_char(d.time_out_end, 'HH24:MI') AS out_end,
            to_char(now() AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS now_time
       FROM employees e JOIN department d USING (department_id)
      WHERE e.qr_token = $1`,
    [token],
  )
  const emp = rows[0]
  if (!emp) return res.status(404).json({ error: 'QR code not recognized. Ask HR for a new QR.' })
  if (!emp.is_active) return res.status(403).json({ error: `${emp.name} is marked inactive. See HR.` })
  const who = { employee_no: emp.employee_no, name: emp.name, department_name: emp.department_name }

  const last = (
    await db.query(
      `SELECT log_type, scanned_at, now() - scanned_at < interval '1 minute' AS recent
         FROM attendance_log
        WHERE employee_id = $1 AND scanned_at >= ${TODAY}
        ORDER BY scanned_at DESC LIMIT 1`,
      [emp.employee_id],
    )
  ).rows[0]
  if (last?.recent) {
    return res.json({ status: 'duplicate', log_type: last.log_type, scanned_at: last.scanned_at, ...who })
  }

  const logType = last?.log_type === 'in' ? 'out' : 'in'
  const [start, end] = logType === 'in' ? [emp.in_start, emp.in_end] : [emp.out_start, emp.out_end]
  if (start && !inWindow(emp.now_time, start, end)) {
    return res.status(403).json({
      error: `${emp.name}: time ${logType} for ${emp.department_name} is only allowed from ${ampm(start)} to ${ampm(end)}.`,
    })
  }
  const saved = await db.query(
    `INSERT INTO attendance_log (employee_id, log_type) VALUES ($1, $2) RETURNING log_id AS id, scanned_at`,
    [emp.employee_id, logType],
  )
  res.status(201).json({ status: 'success', log_type: logType, ...saved.rows[0], ...who })
})
