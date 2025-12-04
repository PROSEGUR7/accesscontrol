import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { LOCATION_COLUMNS, mapLocation, normalizeLocationPayload, type LocationRow } from "./location-utils"

const optionalString = (limit: number, message: string) =>
  z.string().trim().max(limit, message).optional()

export const locationUpsertSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(255, "Nombre demasiado largo"),
  tipo: optionalString(120, "Tipo demasiado largo"),
  descripcion: optionalString(500, "Descripción demasiado larga"),
  activa: z.boolean().optional(),
})

export async function GET() {
  try {
    const rows = await query<LocationRow>(
      `SELECT ${LOCATION_COLUMNS}
       FROM ubicaciones
       ORDER BY nombre ASC`
    )

    const ubicaciones = rows.map(mapLocation)

    return NextResponse.json({ ubicaciones })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron obtener las ubicaciones",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
      `INSERT INTO ubicaciones (nombre, tipo, descripcion, activa)
       VALUES ($1, $2, $3, $4)
       RETURNING ${LOCATION_COLUMNS}`,
      [normalized.nombre, normalized.tipo, normalized.descripcion, normalized.activa]
    )

    const [row] = rows
    if (!row) {
      throw new Error("No se pudo crear la ubicación")
    }

    return NextResponse.json({ ubicacion: mapLocation(row) }, { status: 201 })
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
        error: "No se pudo crear la ubicación",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
