import { query } from "@/lib/db"

export type DailyReportRow = {
  day: string
  total: number
  authorized: number
  denied: number
  pending: number
}

export type RecentReportRow = {
  id: number
  ts: Date
  epc: string | null
  persona: string | null
  objeto: string | null
  puerta: string | null
  tipo: string | null
  motivo: string | null
  authorized: boolean | null
}

export async function getReportsDataForTenant(tenant: string) {
  const [daily, recent] = await Promise.all([
    query<DailyReportRow>(
      `WITH daily AS (
         SELECT date_trunc('day', m.ts)::date AS day,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
                COUNT(*) FILTER (
                  WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                     OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                )::int AS denied
           FROM movimientos m
          WHERE m.ts >= now() - interval '30 days'
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 30
       )
       SELECT to_char(day, 'YYYY-MM-DD') AS day,
              total,
              authorized,
              denied,
              GREATEST(total - authorized - denied, 0)::int AS pending
         FROM daily
        ORDER BY day DESC`,
      undefined,
      tenant,
    ),
    query<RecentReportRow>(
      `SELECT m.id,
              m.ts,
              m.epc,
              per.nombre AS persona,
              obj.nombre AS objeto,
              door.nombre AS puerta,
              m.tipo,
              m.motivo,
              (m.extra->'accessControl'->'decision'->>'authorized')::boolean AS authorized
         FROM movimientos m
         LEFT JOIN personas per ON per.id = m.persona_id
         LEFT JOIN objetos obj ON obj.id = m.objeto_id
         LEFT JOIN puertas door ON door.id = m.puerta_id
        ORDER BY m.ts DESC
        LIMIT 12`,
      undefined,
      tenant,
    ),
  ])

  return { daily, recent }
}
