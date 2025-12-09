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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
  schema?: string,
) {
  if (!connectionString || !pool) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  if (!schema) {
    const { rows } = await pool.query<T>(text, params)
    return rows
  }

  if (!isSafeIdentifier(schema)) {
    throw new Error("Invalid schema name")
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(`SET LOCAL search_path TO ${schema}, public`)
    const { rows } = await client.query<T>(text, params)
    await client.query("COMMIT")
    return rows
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      if (!/no (?:active )?transaction/i.test(message)) {
        console.error("Failed to rollback tenant query", rollbackError)
      }
    }
    throw error
  } finally {
    client.release()
  }
}
