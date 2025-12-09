import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

type CountRow = { active_personnel: number; monitored_doors: number; accesses_today: number; denied_today: number }
type ChartRow = { day: string; total: number }
type RecentRow = {
  id: number
  persona: string | null
  puerta: string | null
  autorizado: boolean | null
  timestamp: string
}

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request)
    const tenant = session?.tenant

    const [countsRow] = await query<CountRow>(
      `SELECT
         (SELECT count(*) FROM personas WHERE habilitado = true) AS active_personnel,
         (SELECT count(*) FROM puertas) AS monitored_doors,
         (SELECT count(*) FROM movimientos WHERE date(ts) = current_date) AS accesses_today,
         (SELECT count(*) FROM movimientos WHERE date(ts) = current_date AND autorizado = false) AS denied_today
       `,
      [],
      tenant ?? undefined,
    )

    const chart = await query<ChartRow>(
      `SELECT date(ts) AS day, count(*)::int AS total
       FROM movimientos
       WHERE ts >= current_date - interval '6 days'
       GROUP BY date(ts)
       ORDER BY day ASC`,
      [],
      tenant ?? undefined,
    )

    const recent = await query<RecentRow>(
      `SELECT id,
              COALESCE(persona_nombre, 'Desconocido') AS persona,
              COALESCE(puerta_nombre, 'Desconocido') AS puerta,
              autorizado,
              ts AS timestamp
       FROM movimientos
       ORDER BY ts DESC
       LIMIT 12`,
      [],
      tenant ?? undefined,
    )

    return NextResponse.json({
      counts: {
        accessesToday: Number(countsRow?.accesses_today ?? 0),
        activePersonnel: Number(countsRow?.active_personnel ?? 0),
        monitoredDoors: Number(countsRow?.monitored_doors ?? 0),
        deniedToday: Number(countsRow?.denied_today ?? 0),
      },
      chart,
      recent,
    })
  } catch (error) {
    console.error("dashboard metrics error", error)
    return NextResponse.json({ message: "No se pudieron cargar las métricas" }, { status: 500 })
  }
}
