import { Pool, type QueryResultRow } from "pg"

const connectionString = process.env.DATABASE_URL

type GlobalWithPool = typeof globalThis & {
  __rfidDbPool?: Pool
}

const globalForPool = globalThis as GlobalWithPool

function createPool(url: string) {
  return new Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false },
  })
}

export const pool = connectionString
  ? globalForPool.__rfidDbPool ?? createPool(connectionString)
  : undefined

if (process.env.NODE_ENV !== "production" && pool) {
  globalForPool.__rfidDbPool = pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]) {
  if (!connectionString || !pool) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  const { rows } = await pool.query<T>(text, params)
  return rows
}
