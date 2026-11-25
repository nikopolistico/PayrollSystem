import { Router } from 'express'
import { db } from '../db.js'
import { requireRole } from '../auth.js'
import { PAYSLIP_SQL } from '../payroll.js'

export const employee = Router()
employee.use(requireRole('employee'))

employee.get('/profile', async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.employee_no, e.first_name, e.middle_name, e.last_name, e.position,
            d.department_name, e.employment_status, e.date_hired, e.contact_no,
            e.sss_no, e.philhealth_no, e.pagibig_no, e.tin
       FROM employees e JOIN department d USING (department_id)
      WHERE e.employee_id = $1`,
    [req.user.employee_id],
  )
  res.json(rows[0])
})

// Only finished periods: an 'open' period's numbers are still being edited by the admin.
employee.get('/payslips', async (req, res) => {
  const { rows } = await db.query(
    `${PAYSLIP_SQL} WHERE s.employee_id = $1 AND p.status <> 'open' ORDER BY v.period_start DESC`,
    [req.user.employee_id],
  )
  res.json(rows)
})
