import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env.local)')

// Render's External URL (used from your PC) needs SSL; the Internal URL (used on Render) does not.
export const db = new pg.Pool({
  connectionString: url,
  ssl: url.includes('.render.com') ? { rejectUnauthorized: true } : false,
})
