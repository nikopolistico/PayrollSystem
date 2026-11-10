import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'

const SECRET = process.env.SESSION_SECRET
if (!SECRET || SECRET.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)')

const WEEK = 7 * 24 * 60 * 60 * 1000
const dist = fileURLToPath(new URL('../dist', import.meta.url))

// Session cookie = "<user_id>.<expires>.<HMAC signature>", so it can't be forged without SECRET.
const sign = (value) => createHmac('sha256', SECRET).update(value).digest('base64url')
const makeToken = (userId) => {
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

const USER_SQL = `
  SELECT u.user_id, u.email, u.role, e.employee_no, e.first_name, e.last_name
    FROM app_user u LEFT JOIN employee e ON e.employee_id = u.employee_id`
const toUser = (r) => ({
  id: r.employee_no ?? r.email,
  name: r.first_name ? `${r.first_name} ${r.last_name}` : r.email,
  role: r.role,
})

const app = express()
app.set('trust proxy', 1) // Render terminates HTTPS in front of the app
app.use(express.json())

app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' })
  }
  const { rows } = await db.query(
    `${USER_SQL} WHERE u.email = lower($1) AND u.password_hash = crypt($2, u.password_hash)`,
    [email.trim(), password],
  )
  const row = rows[0]
  if (!row) return res.status(401).json({ error: 'Invalid email or password.' })
  if (row.role !== role) {
    return res.status(403).json({
      error: `This account is not registered as ${role === 'admin' ? 'an admin' : 'an employee'}.`,
    })
  }
  res.cookie('session', makeToken(row.user_id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: WEEK,
  })
  res.json(toUser(row))
})

app.get('/api/me', async (req, res) => {
  const userId = readSession(req)
  // Role is re-read from the DB on every request, so deleting/changing an account takes effect at once.
  const { rows } = userId ? await db.query(`${USER_SQL} WHERE u.user_id = $1`, [userId]) : { rows: [] }
  if (!rows[0]) return res.status(401).json({ error: 'Not logged in.' })
  res.json(toUser(rows[0]))
})

app.post('/api/logout', (req, res) => {
  res.clearCookie('session').sendStatus(204)
})

app.use('/api', (req, res) => res.sendStatus(404))

// The built Vue app; every other path returns index.html so Vue Router handles it.
app.use(express.static(dist))
app.get('/{*path}', (req, res) => res.sendFile('index.html', { root: dist }))

const port = process.env.PORT ?? 3000
app.listen(port, () => console.log(`Payroll server on http://localhost:${port}`))
