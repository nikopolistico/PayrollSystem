import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env.local)')

// Neon only accepts SSL connections; the Neon URL's ?sslmode=require turns it on.
// Keep DATE columns as 'YYYY-MM-DD' text; pg's default JS Date shifts the day across time zones.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export const db = new pg.Pool({ connectionString: url })

// Neon drops idle connections (auto-suspend); without this listener that crashes the whole server.
db.on('error', (err) => console.error('Idle DB connection dropped:', err.message))
