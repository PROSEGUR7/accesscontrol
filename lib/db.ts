import { Pool, type QueryResultRow } from "pg"

const connectionString = process.env.DATABASE_URL
const schemaName = process.env.PG_SCHEMA

type GlobalWithPool = typeof globalThis & {
  __rfidDbPool?: Pool
}

const globalForPool = globalThis as GlobalWithPool

function isSafeIdentifier(input: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)
}

function createPool(url: string) {
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false },
  })

  if (schemaName) {
    if (!isSafeIdentifier(schemaName)) {
      throw new Error("Invalid schema name for PG_SCHEMA")
    }

    pool.on("connect", (client) => {
      void client.query(`SET search_path TO ${schemaName}, public`)
    })
  }

  return pool
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
