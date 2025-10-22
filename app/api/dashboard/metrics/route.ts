import { NextResponse, type NextRequest } from "next/server"

import { query } from "@/lib/db"
import { getSessionFromRequest } from "@/lib/auth"

export const runtime = "nodejs"

type MovementSummaryRow = {
  accesses_today: number
  accesses_yesterday: number
  denied_today: number
  denied_yesterday: number
}

type CountRow = {
  total: number
}

type ChartRow = {
  day: string
  total: number
}

function computeTrend(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : null
  }
  const delta = current - previous
  return Number(((delta / previous) * 100).toFixed(1))
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)

  if (!session) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 })
  }

  try {
    const [movementSummary] = await query<MovementSummaryRow>(
      `SELECT
         COUNT(*) FILTER (WHERE ts >= date_trunc('day', now()))::int        AS accesses_today,
         COUNT(*) FILTER (WHERE ts >= date_trunc('day', now()) - interval '1 day' AND ts < date_trunc('day', now()))::int AS accesses_yesterday,
         COUNT(*) FILTER (
           WHERE ts >= date_trunc('day', now())
             AND (
               lower(coalesce(tipo, '')) LIKE '%deneg%'
               OR lower(coalesce(motivo, '')) LIKE '%deneg%'
             )
         )::int AS denied_today,
         COUNT(*) FILTER (
           WHERE ts >= date_trunc('day', now()) - interval '1 day'
             AND ts < date_trunc('day', now())
             AND (
               lower(coalesce(tipo, '')) LIKE '%deneg%'
               OR lower(coalesce(motivo, '')) LIKE '%deneg%'
             )
         )::int AS denied_yesterday
       FROM movimientos`
    )

    const [activePeopleRow] = await query<CountRow>(
      `SELECT COUNT(*)::int AS total
         FROM personas
        WHERE habilitado = true
          AND (habilitado_hasta IS NULL OR habilitado_hasta >= now())`
    )

    const [monitoredDoorsRow] = await query<CountRow>(
      `SELECT COUNT(*)::int AS total
         FROM puertas
        WHERE activa = true`
    )

    const chartRows = await query<ChartRow>(
      `WITH days AS (
         SELECT generate_series(
                  date_trunc('day', now()) - interval '6 days',
                  date_trunc('day', now()),
                  interval '1 day'
                )::date AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COALESCE(COUNT(m.*), 0)::int AS total
         FROM days d
         LEFT JOIN movimientos m ON m.ts::date = d.day
        GROUP BY d.day
        ORDER BY d.day`
    )

    const accessesToday = movementSummary?.accesses_today ?? 0
    const accessesYesterday = movementSummary?.accesses_yesterday ?? 0
    const deniedToday = movementSummary?.denied_today ?? 0
    const deniedYesterday = movementSummary?.denied_yesterday ?? 0

    const accessesTrend = computeTrend(accessesToday, accessesYesterday)
    const deniedTrend = computeTrend(deniedToday, deniedYesterday)

    return NextResponse.json({
      stats: {
        accessesToday: {
          value: accessesToday,
          trend: accessesTrend,
        },
        activePeople: activePeopleRow?.total ?? 0,
        monitoredDoors: monitoredDoorsRow?.total ?? 0,
        deniedToday: {
          value: deniedToday,
          trend: deniedTrend,
        },
      },
      chart: chartRows,
    })
  } catch (error) {
    console.error("Failed to load dashboard metrics", error)
    return NextResponse.json({ message: "No se pudieron obtener las métricas" }, { status: 500 })
  }
}
