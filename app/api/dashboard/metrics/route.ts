import { NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

type CountRow = { count: string }
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
}import { NextResponse, type NextRequest } from "next/server"

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
