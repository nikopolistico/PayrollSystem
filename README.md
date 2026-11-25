# Payroll System

- `server/` — backend: Express API + Neon PostgreSQL (`server/db/` holds the SQL)
- `src/` — frontend: Vue 3 + TypeScript

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and paste your Neon connection string.
3. Create login accounts: edit `server/db/create-users.sql`, paste it into the Neon SQL Editor.

## Run

- `npm run server` — API on http://localhost:3000
- `npm run dev` — Vue app (forwards `/api` to the server)
- `npm run build` then `npm start` — production (Express serves the built app)
