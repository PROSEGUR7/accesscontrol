import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { getSocketServer } from "@/lib/socket"

type MovementRow = {
  id: number
  ts: Date
  tipo: string | null
  epc: string | null
  persona_id: number | null
  objeto_id: number | null
  puerta_id: number | null
  lector_id: number | null
  antena_id: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
  created_at: Date
}

const payloadSchema = z.object({
  epc: z.string().min(1, "epc is required"),
  timestamp: z.union([z.string(), z.number()]).optional(),
  tipo: z.string().trim().optional(),
  personaId: z.union([z.string(), z.number()]).optional(),
  objetoId: z.union([z.string(), z.number()]).optional(),
  puertaId: z.union([z.string(), z.number()]).optional(),
  lectorId: z.union([z.string(), z.number()]).optional(),
  antenaId: z.union([z.string(), z.number()]).optional(),
  rssi: z.union([z.string(), z.number()]).optional(),
  direccion: z.string().trim().optional(),
  motivo: z.string().trim().optional(),
  extra: z.union([z.record(z.unknown()), z.array(z.unknown()), z.string()]).optional(),
})

function toOptionalNumber(value: string | number | undefined) {
  if (value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid numeric value")
  }
  return numeric
}

function toOptionalRssi(value: string | number | undefined) {
  if (value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid RSSI value")
  }
  return numeric
}

function normalizeTimestamp(value: string | number | undefined) {
  if (value === undefined) {
    return new Date()
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp")
  }
  return date
}

function formatMovement(row: MovementRow) {
  return {
    id: Number(row.id),
    timestamp: row.ts instanceof Date ? row.ts.toISOString() : new Date(row.ts).toISOString(),
    tipo: row.tipo,
    epc: row.epc,
    personaId: row.persona_id === null ? null : Number(row.persona_id),
    objetoId: row.objeto_id === null ? null : Number(row.objeto_id),
    puertaId: row.puerta_id === null ? null : Number(row.puerta_id),
    lectorId: row.lector_id === null ? null : Number(row.lector_id),
    antenaId: row.antena_id === null ? null : Number(row.antena_id),
    rssi: row.rssi === null ? null : Number(row.rssi),
    direccion: row.direccion,
    motivo: row.motivo,
    extra: row.extra,
  }
}

export async function POST(req: NextRequest) {
  let payload: unknown

  try {
    payload = await req.json()
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload", details: (error as Error).message }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    }, { status: 400 })
  }

  try {
    const { epc, timestamp, tipo, personaId, objetoId, puertaId, lectorId, antenaId, rssi, direccion, motivo, extra } = parsed.data

    const ts = normalizeTimestamp(timestamp)
    const persona = toOptionalNumber(personaId)
    const objeto = toOptionalNumber(objetoId)
    const puerta = toOptionalNumber(puertaId)
    const lector = toOptionalNumber(lectorId)
    const antena = toOptionalNumber(antenaId)
    const signal = toOptionalRssi(rssi)

    const extraPayload = (() => {
      if (extra === undefined) return null
      if (typeof extra === "string") {
        try {
          return JSON.parse(extra)
        } catch {
          return extra
        }
      }
      return extra
    })()

    const [movement] = await query<MovementRow>(
      `INSERT INTO movimientos (
        ts,
        tipo,
        epc,
        persona_id,
        objeto_id,
        puerta_id,
        lector_id,
        antena_id,
        rssi,
        direccion,
        motivo,
        extra
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, ts, tipo, epc, persona_id, objeto_id, puerta_id, lector_id, antena_id, rssi, direccion, motivo, extra, created_at`,
  [ts, tipo ?? null, epc, persona, objeto, puerta, lector, antena, signal, direccion ?? null, motivo ?? null, extraPayload],
    )

    if (!movement) {
      return NextResponse.json({ error: "Movement record not created" }, { status: 500 })
    }

    const formatted = formatMovement(movement)

    const io = getSocketServer()
    io?.emit("rfid-event", formatted)

    return NextResponse.json({ movement: formatted })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process RFID payload", details: (error as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "100")
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 100

  try {
    const rows = await query<MovementRow>(
      `SELECT id, ts, tipo, epc, persona_id, objeto_id, puerta_id, lector_id, antena_id, rssi, direccion, motivo, extra, created_at
       FROM movimientos
       ORDER BY ts DESC
       LIMIT $1`,
      [limit],
    )

    const movements = rows.map((row) => formatMovement(row))

    return NextResponse.json({ movements })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch RFID events", details: (error as Error).message }, { status: 500 })
  }
}
