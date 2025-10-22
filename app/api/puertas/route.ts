import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { DOOR_COLUMNS, mapDoor, type DoorRow } from "./door-utils"

const createDoorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120, "El nombre es demasiado largo"),
  descripcion: z.string().trim().max(255, "La descripción es demasiado larga").optional(),
  ubicacion: z.string().trim().max(120, "La ubicación es demasiado larga").optional(),
  activa: z.boolean().optional(),
})

export async function GET() {
  try {
    const rows = await query<DoorRow>(
      `SELECT ${DOOR_COLUMNS}
       FROM puertas
       ORDER BY created_at DESC`
    )

    const puertas = rows.map(mapDoor)

    return NextResponse.json({ puertas })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron obtener las puertas registradas",
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
      { error: "No se pudo leer el cuerpo de la solicitud", details: (error as Error).message },
      { status: 400 }
    )
  }

  const result = createDoorSchema.safeParse(payload)
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
  const activa = data.activa ?? true

  try {
    const rows = await query<DoorRow>(
      `INSERT INTO puertas (
        nombre,
        descripcion,
        ubicacion,
        activa
      ) VALUES ($1, $2, $3, $4)
      RETURNING ${DOOR_COLUMNS}`,
      [nombre, descripcion, ubicacion, activa]
    )

    const [row] = rows
    if (!row) {
      throw new Error("No se pudo crear la puerta")
    }

    return NextResponse.json({ puerta: mapDoor(row) }, { status: 201 })
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
        error: "No se pudo registrar la puerta",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
