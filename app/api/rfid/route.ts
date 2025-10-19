import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { getSocketServer } from "@/lib/socket"

type MovementRow = {
  id: number
  ts: Date
  tipo: string | null
  epc: string | null
  persona_i: number | null
  objeto_i: number | null
  puerta_i: number | null
  lector_i: number | null
  antena_i: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
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
    personaId: row.persona_i === null ? null : Number(row.persona_i),
    objetoId: row.objeto_i === null ? null : Number(row.objeto_i),
    puertaId: row.puerta_i === null ? null : Number(row.puerta_i),
    lectorId: row.lector_i === null ? null : Number(row.lector_i),
    antenaId: row.antena_i === null ? null : Number(row.antena_i),
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
        persona_i,
        objeto_i,
        puerta_i,
        lector_i,
        antena_i,
        rssi,
        direccion,
        motivo,
        extra
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, ts, tipo, epc, persona_i, objeto_i, puerta_i, lector_i, antena_i, rssi, direccion, motivo, extra`,
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
