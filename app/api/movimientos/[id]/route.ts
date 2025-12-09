import { NextResponse, type NextRequest } from "next/server"

import { query } from "@/lib/db"
import { movementUpsertSchema } from "../route"
import {
  MOVEMENT_COLUMNS,
  buildMovementFromClause,
  mapMovement,
  normalizeMovementPayload,
  type MovementRow,
} from "../movement-utils"
import { getSessionFromRequest } from "@/lib/auth"

type Params = {
  params: {
    id: string
  }
}

function parseId(raw: string) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request)

  if (!session?.tenant) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const movementId = parseId(params.id)
  if (!movementId) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  try {
    const rows = await query<MovementRow>(
      `WITH deleted AS (
         DELETE FROM movimientos
         WHERE id = $1
         RETURNING *
       )
       SELECT ${MOVEMENT_COLUMNS}
       ${buildMovementFromClause("deleted m")}
       LIMIT 1`,
      [movementId],
      session.tenant,
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "El movimiento no existe" }, { status: 404 })
    }

    return NextResponse.json({ movimiento: mapMovement(row) })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar el movimiento", details: (error as Error).message },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request)

  if (!session?.tenant) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const movementId = parseId(params.id)
  if (!movementId) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

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
    const rows = await query<MovementRow>(
      `WITH updated AS (
         UPDATE movimientos
          SET ts = $2,
                tipo = $3,
                epc = $4,
                persona_id = $5,
                objeto_id = $6,
                puerta_id = $7,
                lector_id = $8,
                antena_id = $9,
                rssi = $10,
                direccion = $11,
            motivo = $12,
            extra = $13
          WHERE id = $1
          RETURNING *
       )
       SELECT ${MOVEMENT_COLUMNS}
       ${buildMovementFromClause("updated m")}
       LIMIT 1`,
      [
        movementId,
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
      session.tenant,
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "El movimiento no existe" }, { status: 404 })
    }

    return NextResponse.json({ movimiento: mapMovement(row) })
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar el movimiento", details: (error as Error).message },
      { status: 500 },
    )
  }
}
