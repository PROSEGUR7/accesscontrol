import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import {
  MOVEMENT_COLUMNS,
  buildMovementFromClause,
  mapMovement,
  normalizeMovementPayload,
  type MovementRow,
} from "./movement-utils"

const timestampSchema = z
  .union([z.string().trim().min(1, "Marca de tiempo inválida"), z.number(), z.date()])
  .optional()

const optionalString = (limit: number, message: string) => z.string().trim().max(limit, message).optional()

const idField = z.number().int().positive()

const rssiField = z.number().min(-200).max(200).optional()

const STATUS_VALUES = new Set(["authorized", "denied", "pending"])
const DEFAULT_PAGE_SIZE = 25
const MIN_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 200

function clampPageSize(raw: number | null | undefined) {
  if (!Number.isFinite(raw)) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(Math.trunc(raw as number), MIN_PAGE_SIZE), MAX_PAGE_SIZE)
}

function clampPage(raw: number | null | undefined) {
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.trunc(raw as number))
}

function parseDateParam(value: string | null, mode: "start" | "end") {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const result = new Date(date)
  if (mode === "start") {
    result.setHours(0, 0, 0, 0)
  } else {
    result.setHours(23, 59, 59, 999)
  }
  return result
}

export const movementUpsertSchema = z.object({
  timestamp: timestampSchema,
  tipo: optionalString(120, "Tipo demasiado largo"),
  epc: z.string().trim().min(4, "El EPC es obligatorio").max(24, "El EPC debe tener 24 caracteres o menos"),
  personaId: idField.optional(),
  objetoId: idField.optional(),
  puertaId: idField.optional(),
  lectorId: idField.optional(),
  antenaId: idField.optional(),
  rssi: rssiField,
  direccion: optionalString(80, "Dirección demasiado larga"),
  motivo: optionalString(255, "Motivo demasiado largo"),
  extra: z
    .union([
      z.record(z.unknown()),
      z.array(z.unknown()),
      z.string().trim().max(4000, "Payload extra demasiado largo"),
    ])
    .nullable()
    .optional(),
})

async function fetchMovementById(id: number) {
  const rows = await query<MovementRow>(
    `SELECT ${MOVEMENT_COLUMNS}
     ${buildMovementFromClause()}
     WHERE m.id = $1
     LIMIT 1`,
    [id],
  )

  const [row] = rows
  return row ? mapMovement(row) : null
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim()
  const statusRaw = request.nextUrl.searchParams.get("status")?.toLowerCase()
  const status = statusRaw && STATUS_VALUES.has(statusRaw) ? statusRaw : null
  const fromDate = parseDateParam(request.nextUrl.searchParams.get("from"), "start")
  const toDate = parseDateParam(request.nextUrl.searchParams.get("to"), "end")
  const pageParam = clampPage(Number(request.nextUrl.searchParams.get("page") ?? "1"))
  const pageSize = clampPageSize(Number(request.nextUrl.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE))

  const filters: string[] = []
  const params: unknown[] = []

  if (fromDate) {
    params.push(fromDate)
    filters.push(`m.ts >= $${params.length}`)
  }

  if (toDate) {
    params.push(toDate)
    filters.push(`m.ts <= $${params.length}`)
  }

  if (status === "authorized") {
    filters.push("COALESCE((m.extra->'accessControl'->'decision'->>'authorized')::boolean, false) = true")
  } else if (status === "denied") {
    filters.push("COALESCE((m.extra->'accessControl'->'decision'->>'authorized')::boolean, false) = false")
  } else if (status === "pending") {
    filters.push("(m.extra->'accessControl'->'decision'->>'authorized') IS NULL")
  }

  if (search) {
    const pattern = `%${search}%`
    params.push(pattern)
    const placeholder = `$${params.length}`
    filters.push(`(
      m.epc ILIKE ${placeholder}
      OR EXISTS (SELECT 1 FROM personas per WHERE per.id = m.persona_id AND per.nombre ILIKE ${placeholder})
      OR EXISTS (SELECT 1 FROM objetos obj WHERE obj.id = m.objeto_id AND obj.nombre ILIKE ${placeholder})
      OR EXISTS (SELECT 1 FROM puertas door WHERE door.id = m.puerta_id AND door.nombre ILIKE ${placeholder})
    )`)
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

  try {
    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*)::bigint AS count
       FROM movimientos m
       ${whereClause}`,
      params,
    )

    const total = Number(countRows[0]?.count ?? 0)
    const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(pageParam, totalPages)
    const offset = (page - 1) * pageSize

    const dataParams = [...params, pageSize, offset]
    const rows = await query<MovementRow>(
      `SELECT ${MOVEMENT_COLUMNS}
       ${buildMovementFromClause()}
       ${whereClause}
       ORDER BY m.ts DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams,
    )

    const movimientos = rows.map(mapMovement)

    return NextResponse.json({
      movimientos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron obtener los movimientos", details: (error as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo leer el cuerpo de la solicitud", details: (error as Error).message },
      { status: 400 },
    )
  }

  const result = movementUpsertSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: result.error.flatten() },
      { status: 400 },
    )
  }

  let normalized
  try {
    normalized = normalizeMovementPayload({
      timestamp: result.data.timestamp,
      tipo: result.data.tipo,
      epc: result.data.epc,
      personaId: result.data.personaId,
      objetoId: result.data.objetoId,
      puertaId: result.data.puertaId,
      lectorId: result.data.lectorId,
      antenaId: result.data.antenaId,
      rssi: result.data.rssi,
      direccion: result.data.direccion,
      motivo: result.data.motivo,
      extra: result.data.extra ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }

  try {
    const inserted = await query<{ id: number }>(
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
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING id`,
      [
        normalized.ts,
        normalized.tipo,
        normalized.epc,
        normalized.personaId,
        normalized.objetoId,
        normalized.puertaId,
        normalized.lectorId,
        normalized.antenaId,
        normalized.rssi,
        normalized.direccion,
        normalized.motivo,
        normalized.extra,
      ],
    )

    const record = inserted[0]
    if (!record) {
      throw new Error("No se pudo registrar el movimiento")
    }

    const movimiento = await fetchMovementById(record.id)
    if (!movimiento) {
      throw new Error("No se pudo recuperar el movimiento registrado")
    }

    return NextResponse.json({ movimiento }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo registrar el movimiento",
        details: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
