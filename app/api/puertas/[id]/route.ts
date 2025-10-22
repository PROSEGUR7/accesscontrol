import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { DOOR_COLUMNS, mapDoor, type DoorRow } from "../door-utils"

const paramsSchema = z.object({
  id: z.string().min(1, "El identificador es obligatorio"),
})

const updateDoorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120, "El nombre es demasiado largo"),
  descripcion: z.string().trim().max(255, "La descripción es demasiado larga").optional(),
  ubicacion: z.string().trim().max(120, "La ubicación es demasiado larga").optional(),
  activa: z.boolean(),
})

type Params = {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const parsedParams = paramsSchema.safeParse(params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = Number(parsedParams.data.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo leer el cuerpo de la solicitud", details: (error as Error).message },
      { status: 400 }
    )
  }

  const result = updateDoorSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        issues: result.error.flatten(),
      },
      { status: 400 }
    )
  }

  const data = result.data

  const nombre = data.nombre
  const descripcion = data.descripcion && data.descripcion.length > 0 ? data.descripcion : null
  const ubicacion = data.ubicacion && data.ubicacion.length > 0 ? data.ubicacion : null
  const activa = data.activa

  try {
    const rows = await query<DoorRow>(
      `UPDATE puertas
       SET nombre = $2,
           descripcion = $3,
           ubicacion = $4,
           activa = $5,
           updated_at = now()
       WHERE id = $1
       RETURNING ${DOOR_COLUMNS}`,
      [id, nombre, descripcion, ubicacion, activa]
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La puerta no existe" }, { status: 404 })
    }

    return NextResponse.json({ puerta: mapDoor(row) })
  } catch (error) {
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      return NextResponse.json(
        { error: "El nombre de la puerta ya está registrado" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar la puerta",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const parsedParams = paramsSchema.safeParse(params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = Number(parsedParams.data.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  try {
    const rows = await query<DoorRow>(
      `DELETE FROM puertas
       WHERE id = $1
       RETURNING ${DOOR_COLUMNS}`,
      [id]
    )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La puerta no existe" }, { status: 404 })
    }

    return NextResponse.json({ puerta: mapDoor(row) })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar la puerta",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
