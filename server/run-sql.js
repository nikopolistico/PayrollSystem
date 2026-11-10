// Runs a .sql file against DATABASE_URL:  npm run sql -- db/schema.sql
import { readFileSync } from 'node:fs'
import { db } from './db.js'

const file = process.argv[2]
if (!file) throw new Error('Usage: npm run sql -- <file.sql>')
try {
  await db.query(readFileSync(file, 'utf8'))
  console.log(`Ran ${file}`)
} finally {
  await db.end()
}
