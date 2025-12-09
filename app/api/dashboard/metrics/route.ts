import { NextResponse, type NextRequest } from "next/server"

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

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    const tenant = session?.tenant

    if (!tenant) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const [countsRow] = await query<CountRow>(
      `SELECT
         (SELECT count(*) FROM personas WHERE habilitado = true) AS active_personnel,
         (SELECT count(*) FROM puertas) AS monitored_doors,
         (SELECT count(*) FROM movimientos WHERE date(ts) = current_date) AS accesses_today,
         (SELECT count(*) FROM movimientos WHERE date(ts) = current_date AND autorizado = false) AS denied_today
       `,
      [],
      tenant,
    )

    const chart = await query<ChartRow>(
      `SELECT date(ts) AS day, count(*)::int AS total
       FROM movimientos
       WHERE ts >= current_date - interval '6 days'
       GROUP BY date(ts)
       ORDER BY day ASC`,
      [],
      tenant,
    )

    const recent = await query<RecentRow>(
      `SELECT m.id,
              COALESCE(per.nombre, 'Desconocido') AS persona,
              COALESCE(door.nombre, 'Desconocido') AS puerta,
              m.autorizado,
              m.ts AS timestamp
       FROM movimientos m
       LEFT JOIN personas per ON per.id = m.persona_id
       LEFT JOIN puertas door ON door.id = m.puerta_id
       ORDER BY m.ts DESC
       LIMIT 12`,
      [],
      tenant,
    )

    const stats = {
      accessesToday: {
        value: Number(countsRow?.accesses_today ?? 0),
        trend: null as number | null,
      },
      activePeople: Number(countsRow?.active_personnel ?? 0),
      monitoredDoors: Number(countsRow?.monitored_doors ?? 0),
      deniedToday: {
        value: Number(countsRow?.denied_today ?? 0),
        trend: null as number | null,
      },
    }

    return NextResponse.json({
      stats,
      chart,
      recent,
    })
  } catch (error) {
    console.error("dashboard metrics error", error)
    return NextResponse.json({ message: "No se pudieron cargar las métricas" }, { status: 500 })
  }
}
