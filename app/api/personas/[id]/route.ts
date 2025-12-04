import { NextResponse } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"

import { KEY_DEFAULT_TYPE } from "../../keys/key-utils"
import { personUpsertSchema } from "../route"
import { PERSON_COLUMNS, mapPerson, type PersonRow } from "../persona-utils"

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("El identificador es obligatorio"),
})

type Params = {
  params: {
    id: string
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = parsed.data.id

  try {
    const rows = await query<PersonRow>(
      `DELETE FROM personas
       WHERE id = $1
       RETURNING ${PERSON_COLUMNS}`,
      [id],
    )

    const [deleted] = rows

    if (!deleted) {
      return NextResponse.json({ error: "La persona no existe" }, { status: 404 })
    }

    return NextResponse.json({ persona: mapPerson(deleted) })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar a la persona",
        details: (error as Error).message,
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: Params) {
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
      { error: "No se pudo leer el cuerpo de la solicitud", details: (error as Error).message },
      { status: 400 },
    )
  }

  const result = personUpsertSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        issues: result.error.flatten(),
      },
      { status: 400 },
    )
  }

  const data = result.data
  const nombre = data.nombre
  const documento = data.documento && data.documento.length > 0 ? data.documento : null
  const rfidEpc = data.rfidEpc && data.rfidEpc.length > 0 ? data.rfidEpc : null
  const habilitado = data.habilitado ?? false
  const habilitadoDesde = data.habilitadoDesde ? new Date(data.habilitadoDesde) : null
  const habilitadoHasta = data.habilitadoHasta ? new Date(data.habilitadoHasta) : null

  try {
    if (rfidEpc) {
      const [keyConflict] = await query<{ id: number; tipo: string }>(
        `SELECT id, tipo FROM objetos WHERE rfid_epc = $1 LIMIT 1`,
        [rfidEpc],
      )

      if (keyConflict) {
        if (keyConflict.tipo === KEY_DEFAULT_TYPE) {
          return NextResponse.json(
            { error: "El EPC RFID ya está asignado a un objeto" },
            { status: 409 },
          )
        }

        return NextResponse.json(
          { error: "El EPC ya está asignado a otra entidad" },
          { status: 409 },
        )
      }

      const [personaConflict] = await query<{ id: number }>(
        `SELECT id FROM personas WHERE rfid_epc = $1 AND id <> $2 LIMIT 1`,
        [rfidEpc, id],
      )

      if (personaConflict) {
        return NextResponse.json(
          { error: "El EPC RFID ya está asignado a otra persona" },
          { status: 409 },
        )
      }
    }

    const rows = await query<PersonRow>(
      `UPDATE personas
         SET nombre = $2,
             documento = $3,
             rfid_epc = $4,
             habilitado = $5,
             habilitado_desde = $6,
             habilitado_hasta = $7,
             updated_at = NOW()
       WHERE id = $1
       RETURNING ${PERSON_COLUMNS}`,
      [id, nombre, documento, rfidEpc, habilitado, habilitadoDesde, habilitadoHasta],
    )

    const [updated] = rows

    if (!updated) {
      return NextResponse.json({ error: "La persona no existe" }, { status: 404 })
    }

    return NextResponse.json({ persona: mapPerson(updated) })
  } catch (error) {
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      return NextResponse.json(
        { error: "El EPC RFID ya está asignado" },
        { status: 409 },
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar a la persona",
        details: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
