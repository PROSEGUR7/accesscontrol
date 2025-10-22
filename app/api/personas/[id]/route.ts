import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"

import { PERSON_COLUMNS, mapPerson, type PersonRow } from "../persona-utils"

const paramsSchema = z.object({
  id: z.string().min(1, "El identificador es obligatorio"),
})

type Params = {
  params: {
    id: string
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  const id = Number(parsed.data.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

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
