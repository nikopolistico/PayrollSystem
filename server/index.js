import express from 'express'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { USER_SQL, WEEK, currentUser, makeToken, toUser } from './auth.js'
import { admin } from './routes/admin.js'
import { employee } from './routes/employee.js'
import { scanner } from './routes/scanner.js'

const dist = fileURLToPath(new URL('../dist', import.meta.url))

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
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not logged in.' })
  res.json(toUser(user))
})

app.post('/api/logout', (req, res) => {
  res.clearCookie('session').sendStatus(204)
})

app.use('/api/admin', admin)
app.use('/api/employee', employee)
app.use('/api/scanner', scanner)
app.use('/api', (req, res) => res.sendStatus(404))

// The built Vue app; every other path returns index.html so Vue Router handles it.
app.use(express.static(dist))
app.get('/{*path}', (req, res) => res.sendFile('index.html', { root: dist }))

// Unexpected errors (e.g. a DB problem): log the details here, send the page a JSON message it can show.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server. Try again; if it keeps happening, tell the admin.' })
})

const port = process.env.PORT ?? 3000
app.listen(port, () => console.log(`Payroll server on http://localhost:${port}`))
