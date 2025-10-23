import { NextResponse } from "next/server"

import { query } from "@/lib/db"
import { keyUpsertSchema } from "../route"
import { KEY_COLUMNS, KEY_DEFAULT_TYPE, mapKey, normalizeKeyPayload, type KeyRow } from "../key-utils"

function getTypeFilters() {
  const raw = process.env.KEY_TYPES
  if (!raw) return null
  const values = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return values.length > 0 ? values : null
}

type Params = {
  params: {
    id: string
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = params

  const objectId = Number(id)
  if (!Number.isFinite(objectId) || objectId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 })
  }

  try {
    const typeFilters = getTypeFilters()

    const rows = typeFilters
      ? await query<KeyRow>(
        `WITH deleted AS (
           DELETE FROM objetos
           WHERE id = $1
             AND lower(tipo) = ANY($2)
           RETURNING *
         )
         SELECT ${KEY_COLUMNS}
         FROM deleted o
         LEFT JOIN personas cust ON cust.id = o.custodio_id
         LEFT JOIN personas prop ON prop.id = o.propietario_id
         LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id`,
        [objectId, typeFilters]
      )
      : await query<KeyRow>(
        `WITH deleted AS (
           DELETE FROM objetos
           WHERE id = $1
           RETURNING *
         )
         SELECT ${KEY_COLUMNS}
         FROM deleted o
         LEFT JOIN personas cust ON cust.id = o.custodio_id
         LEFT JOIN personas prop ON prop.id = o.propietario_id
         LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id`,
        [objectId]
      )

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La llave no existe" }, { status: 404 })
    }

    return NextResponse.json({ llave: mapKey(row) })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar la llave",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = params

  const objectId = Number(id)
  if (!Number.isFinite(objectId) || objectId <= 0) {
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

  const result = keyUpsertSchema.safeParse(payload)
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        issues: result.error.flatten(),
      },
      { status: 400 }
    )
  }

  const normalized = normalizeKeyPayload(result.data)

  try {
    if (normalized.rfidEpc) {
      const [personaConflict] = await query<{ id: number }>(
        `SELECT id FROM personas WHERE rfid_epc = $1 LIMIT 1`,
        [normalized.rfidEpc],
      )

      if (personaConflict) {
        const values = [normalized.rfidEpc, KEY_DEFAULT_TYPE]
        const [keyConflict] = await query<{ id: number }>(
          `SELECT id FROM objetos WHERE rfid_epc = $1 AND tipo <> $2 LIMIT 1`,
          values,
        )

        if (keyConflict) {
          return NextResponse.json(
            { error: "El EPC ya está asignado a otra entidad" },
            { status: 409 },
          )
        }

        return NextResponse.json(
          { error: "El EPC ya está asignado a una persona" },
          { status: 409 },
        )
      }
    }

    const typeFilters = getTypeFilters()

    const baseQuery = `WITH updated AS (
      UPDATE objetos
         SET nombre = $2,
             tipo = $3,
             descripcion = $4,
             rfid_epc = $5,
             estado = $6,
             propietario_id = $7,
             zona_actual = $8,
             codigo_activo = $9,
             categoria = $10,
             marca = $11,
             modelo = $12,
             serial = $13,
             valor = $14,
             fecha_compra = $15,
             vida_util_meses = $16,
             centro_costo = $17,
             custodio_id = $18,
             ubicacion_id = $19,
             updated_at = NOW()
       WHERE id = $1
         %FILTER%
       RETURNING *
    )
    SELECT ${KEY_COLUMNS}
    FROM updated o
    LEFT JOIN personas cust ON cust.id = o.custodio_id
    LEFT JOIN personas prop ON prop.id = o.propietario_id
    LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id`

    const filteredQuery = typeFilters
      ? baseQuery.replace("%FILTER%", "AND lower(tipo) = ANY($20)")
      : baseQuery.replace("%FILTER%", "")

    const paramsBase = [
      objectId,
      normalized.nombre,
      KEY_DEFAULT_TYPE,
      normalized.descripcion,
      normalized.rfidEpc,
      normalized.estado,
      normalized.propietarioId,
      normalized.zonaActual,
      normalized.codigoActivo,
      normalized.categoria,
      normalized.marca,
      normalized.modelo,
      normalized.serial,
      normalized.valor,
      normalized.fechaCompra,
      normalized.vidaUtilMeses,
      normalized.centroCosto,
      normalized.custodioId,
      normalized.ubicacionId,
    ]

    const params = typeFilters ? [...paramsBase, typeFilters] : paramsBase

    const rows = await query<KeyRow>(filteredQuery, params)

    const [row] = rows
    if (!row) {
      return NextResponse.json({ error: "La llave no existe" }, { status: 404 })
    }

    return NextResponse.json({ llave: mapKey(row) })
  } catch (error) {
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      return NextResponse.json(
        { error: "El EPC o código activo ya está asignado" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar la llave",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
