import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { locationUpsertSchema } from "../route"
import { LOCATION_COLUMNS, mapLocation, normalizeLocationPayload, type LocationRow } from "../location-utils"
import { getSessionFromRequest } from "@/lib/auth"

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("Identificador inválido"),
})

type Params = {
  params: {
    id: string
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request)

  if (!session?.tenant) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = parsed.data.id

  try {
    const rows = await query<LocationRow>(
      `DELETE FROM ubicaciones
       WHERE id = $1
       RETURNING ${LOCATION_COLUMNS}`,
      [id],
      session.tenant,
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La ubicación no existe" }, { status: 404 })
    }

    return NextResponse.json({ ubicacion: mapLocation(row) })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar la ubicación",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(request)

  if (!session?.tenant) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = parsed.data.id

  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo leer la solicitud", details: (error as Error).message },
      { status: 400 }
    )
  }

  const result = locationUpsertSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        issues: result.error.flatten(),
      },
      { status: 400 }
    )
  }

  const normalized = normalizeLocationPayload(result.data)

  try {
    const rows = await query<LocationRow>(
      `UPDATE ubicaciones
          SET nombre = $2,
              tipo = $3,
              descripcion = $4,
              activa = $5,
              updated_at = NOW()
        WHERE id = $1
        RETURNING ${LOCATION_COLUMNS}`,
      [id, normalized.nombre, normalized.tipo, normalized.descripcion, normalized.activa],
      session.tenant,
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La ubicación no existe" }, { status: 404 })
    }

    return NextResponse.json({ ubicacion: mapLocation(row) })
  } catch (error) {
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      return NextResponse.json(
        { error: "El nombre ya está registrado" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar la ubicación",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
