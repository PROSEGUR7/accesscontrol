import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { mapPerson, PERSON_COLUMNS, type PersonRow } from "./persona-utils"

const createPersonSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(255, "El nombre es demasiado largo"),
  documento: z.string().trim().max(120, "Documento demasiado largo").optional(),
  rfidEpc: z.string().trim().max(128, "RFID demasiado largo").optional(),
  habilitado: z.boolean().optional(),
  habilitadoDesde: z.union([z.string().datetime(), z.null()]).optional(),
  habilitadoHasta: z.union([z.string().datetime(), z.null()]).optional(),
}).superRefine((value, ctx) => {
  if (value.habilitadoDesde && value.habilitadoHasta) {
    const start = new Date(value.habilitadoDesde)
    const end = new Date(value.habilitadoHasta)

    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de fin debe ser posterior a la fecha de inicio",
        path: ["habilitadoHasta"],
      })
    }
  }
})

export async function GET() {
  try {
    const rows = await query<PersonRow>(
      `SELECT ${PERSON_COLUMNS}
       FROM personas
       ORDER BY created_at DESC`
    )

    const personas = rows.map(mapPerson)

    return NextResponse.json({ personas })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron obtener las personas registradas",
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

  const result = createPersonSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json({
      error: "Datos inválidos",
      issues: result.error.flatten(),
    }, { status: 400 })
  }

  const data = result.data

  const nombre = data.nombre
  const documento = data.documento && data.documento.length > 0 ? data.documento : null
  const rfidEpc = data.rfidEpc && data.rfidEpc.length > 0 ? data.rfidEpc : null
  const habilitado = data.habilitado ?? false
  const habilitadoDesde = data.habilitadoDesde ? new Date(data.habilitadoDesde) : null
  const habilitadoHasta = data.habilitadoHasta ? new Date(data.habilitadoHasta) : null

  try {
    const rows = await query<PersonRow>(
      `INSERT INTO personas (
        nombre,
        documento,
        rfid_epc,
        habilitado,
        habilitado_desde,
        habilitado_hasta
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${PERSON_COLUMNS}`,
      [nombre, documento, rfidEpc, habilitado, habilitadoDesde, habilitadoHasta]
    )

    const [row] = rows
    if (!row) {
      throw new Error("No se pudo crear la persona")
    }

    return NextResponse.json({ persona: mapPerson(row) }, { status: 201 })
  } catch (error) {
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      return NextResponse.json(
        { error: "El EPC RFID ya está asignado a otra persona" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo registrar a la persona",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
