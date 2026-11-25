import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from './db.js'

const SECRET = process.env.SESSION_SECRET
if (!SECRET || SECRET.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)')

export const WEEK = 7 * 24 * 60 * 60 * 1000

// Session cookie = "<user_id>.<expires>.<HMAC signature>", so it can't be forged without SECRET.
const sign = (value) => createHmac('sha256', SECRET).update(value).digest('base64url')
export const makeToken = (userId) => {
  const value = `${userId}.${Date.now() + WEEK}`
  return `${value}.${sign(value)}`
}
function readSession(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1]
  const [id, expires, sig] = token?.split('.') ?? []
  if (!sig) return null
  const expected = Buffer.from(sign(`${id}.${expires}`))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return Number(expires) > Date.now() ? Number(id) : null
}

export const USER_SQL = `
  SELECT u.user_id, u.email, u.role, u.employee_id, e.employee_no, e.first_name, e.last_name
    FROM app_user u LEFT JOIN employees e ON e.employee_id = u.employee_id`

export const toUser = (r) => ({
  id: r.employee_no ?? r.email,
  name: r.first_name ? `${r.first_name} ${r.last_name}` : r.email,
  role: r.role,
})

// Role is re-read from the DB on every request, so deleting/changing an account takes effect at once.
export async function currentUser(req) {
  const userId = readSession(req)
  if (!userId) return null
  const { rows } = await db.query(`${USER_SQL} WHERE u.user_id = $1`, [userId])
  return rows[0] ?? null
}

// Route guard: only lets the given role(s) through and puts the account row on req.user.
export const requireRole = (...roles) => async (req, res, next) => {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not logged in.' })
  if (!roles.includes(user.role)) return res.status(403).json({ error: 'Not allowed for this account.' })
  req.user = user
  next()
}
