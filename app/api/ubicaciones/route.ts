import { NextResponse } from "next/server"

import { query } from "@/lib/db"
import type { Location } from "@/types/location"

type LocationRow = {
  id: number
  nombre: string
  tipo: string | null
  descripcion: string | null
  activa: boolean
}

export async function GET() {
  try {
    const rows = await query<LocationRow>(
      `SELECT id, nombre, tipo, descripcion, activa
       FROM ubicaciones
       ORDER BY nombre ASC`
    )

    const ubicaciones: Location[] = rows.map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      tipo: row.tipo,
      descripcion: row.descripcion,
      activa: Boolean(row.activa),
    }))

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
