import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"

export const runtime = "nodejs"

const paramsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(["movimientos", "denegados", "todos"]).optional(),
  limit: z.coerce.number().optional(),
})

type MovementReportRow = {
  id: number
  ts: string
  tipo: string | null
  epc: string | null
  direccion: string | null
  motivo: string | null
  created_at: string
  persona_nombre: string | null
  objeto_nombre: string | null
  puerta_nombre: string | null
}

function parseDate(value: string | undefined) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const parsed = paramsSchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      type: (url.searchParams.get("type") as "movimientos" | "denegados" | "todos" | null) ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ message: "Parámetros inválidos" }, { status: 400 })
    }

    const now = new Date()
    const from = parseDate(parsed.data.from) ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const to = parseDate(parsed.data.to) ?? now

    if (from > to) {
      return NextResponse.json({ message: "La fecha inicial no puede ser posterior a la final." }, { status: 400 })
    }

    const limit = Math.min(parsed.data.limit ?? 500, 2000)
    const reportType = parsed.data.type ?? "movimientos"

    const filters: string[] = ["m.ts >= $1", "m.ts <= $2"]
    if (reportType === "denegados") {
      filters.push(`(
        lower(coalesce(m.tipo, '')) LIKE '%deneg%'
        OR lower(coalesce(m.motivo, '')) LIKE '%deneg%'
      )`)
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : ""

    const rows = await query<MovementReportRow>(
      `SELECT
         m.id,
         m.ts,
         m.tipo,
         m.epc,
         m.direccion,
         m.motivo,
         m.created_at,
         per.nombre AS persona_nombre,
         obj.nombre AS objeto_nombre,
         pu.nombre AS puerta_nombre
       FROM tenant_base.movimientos m
       LEFT JOIN tenant_base.personas per ON per.id = m.persona_id
       LEFT JOIN tenant_base.objetos obj ON obj.id = m.objeto_id
       LEFT JOIN tenant_base.puertas pu ON pu.id = m.puerta_id
       ${whereClause}
       ORDER BY m.ts DESC
       LIMIT ${limit}`,
      [from.toISOString(), to.toISOString()],
    )

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        timestamp: row.ts,
        tipo: row.tipo,
        epc: row.epc,
        direccion: row.direccion,
        motivo: row.motivo,
        persona: row.persona_nombre,
        objeto: row.objeto_nombre,
        puerta: row.puerta_nombre,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    console.error("Failed to load report data", error)
    return NextResponse.json({ message: "No fue posible obtener los datos." }, { status: 500 })
  }
}
