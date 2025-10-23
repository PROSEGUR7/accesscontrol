import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { KEY_COLUMNS, KEY_DEFAULT_TYPE, mapKey, normalizeKeyPayload, type KeyRow } from "./key-utils"

const allowedStates = ["activo", "baja", "extraviado"] as const

function getTypeFilters() {
  const raw = process.env.KEY_TYPES
  if (!raw) return null
  const values = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return values.length > 0 ? values : null
}

const typeFilters = getTypeFilters()

const optionalString = (limit: number, message: string) =>
  z.string().trim().max(limit, message).optional()

const optionalEpc = z
  .string()
  .trim()
  .length(24, "El EPC debe tener 24 caracteres")
  .optional()

export const keyUpsertSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(255, "Nombre demasiado largo"),
    descripcion: optionalString(500, "Descripción demasiado larga"),
    rfidEpc: optionalEpc,
    codigoActivo: optionalString(128, "Código activo demasiado largo"),
    estado: z.enum(allowedStates).default("activo"),
    propietarioId: z.number().int().positive().optional(),
    custodioId: z.number().int().positive().optional(),
    ubicacionId: z.number().int().positive().optional(),
    zonaActual: optionalString(120, "Zona demasiado larga"),
    categoria: optionalString(120, "Categoría demasiado larga"),
    marca: optionalString(120, "Marca demasiado larga"),
    modelo: optionalString(120, "Modelo demasiado largo"),
    serial: optionalString(120, "Serial demasiado largo"),
    valor: z.number().nonnegative().optional(),
    fechaCompra: z.string().trim().min(1).optional(),
    vidaUtilMeses: z.number().int().nonnegative().optional(),
    centroCosto: optionalString(120, "Centro de costo demasiado largo"),
  })
  .superRefine((value, ctx) => {
    if (value.fechaCompra) {
      const parsed = new Date(value.fechaCompra)
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de compra no es válida",
          path: ["fechaCompra"],
        })
      }
    }
  })

export async function GET() {
  try {
    const baseQuery = `SELECT ${KEY_COLUMNS}
       FROM objetos o
       LEFT JOIN personas cust ON cust.id = o.custodio_id
       LEFT JOIN personas prop ON prop.id = o.propietario_id
       LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id`

    const rows = typeFilters
      ? await query<KeyRow>(
        `${baseQuery}
         WHERE lower(o.tipo) = ANY($1)
         ORDER BY o.created_at DESC`,
        [typeFilters]
      )
      : await query<KeyRow>(
        `${baseQuery}
         ORDER BY o.created_at DESC`
      )

    const llaves = rows.map(mapKey)

    return NextResponse.json({ llaves })
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron obtener las llaves registradas",
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
    const inserted = await query<{ id: number }>(
      `INSERT INTO objetos (
        nombre,
        tipo,
        descripcion,
        rfid_epc,
        estado,
        propietario_id,
        zona_actual,
        codigo_activo,
        categoria,
        marca,
        modelo,
        serial,
        valor,
        fecha_compra,
        vida_util_meses,
        centro_costo,
        custodio_id,
        ubicacion_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING id`,
      [
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
    )

    const insertedRow = inserted[0]
    if (!insertedRow) {
      throw new Error("No se pudo registrar la llave")
    }

    const [row] = await query<KeyRow>(
      `SELECT ${KEY_COLUMNS}
       FROM objetos o
       LEFT JOIN personas cust ON cust.id = o.custodio_id
       LEFT JOIN personas prop ON prop.id = o.propietario_id
       LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id
       WHERE o.id = $1`,
      [insertedRow.id]
    )

    if (!row) {
      throw new Error("No se pudo recuperar la llave recién creada")
    }

    return NextResponse.json({ llave: mapKey(row) }, { status: 201 })
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
        error: "No se pudo registrar la llave",
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
