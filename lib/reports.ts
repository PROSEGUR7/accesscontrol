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
  personaId: number | null
  persona: string | null
  personaEpc: string | null
  personaHabilitada: boolean | null
  objetoId: number | null
  objeto: string | null
  objetoTipo: string | null
  objetoEstado: string | null
  puertaId: number | null
  puerta: string | null
  puertaActiva: boolean | null
  lectorId: number | null
  lector: string | null
  lectorIp: string | null
  antenaId: number | null
  antena: string | null
  tipo: string | null
  direccion: string | null
  motivo: string | null
  rssi: number | null
  authorized: boolean | null
  decisionReason: string | null
  decisionCodes: string[]
  decisionNotes: string[]
}

export type PersonaActivityRow = {
  personaId: number | null
  persona: string | null
  personaEpc: string | null
  personaHabilitada: boolean | null
  total: number
  authorized: number
  denied: number
  pending: number
  lastSeen: Date | null
}

export type ObjectActivityRow = {
  objetoId: number | null
  objeto: string | null
  objetoTipo: string | null
  objetoEstado: string | null
  total: number
  authorized: number
  denied: number
  pending: number
  lastSeen: Date | null
}

export type DoorActivityRow = {
  puertaId: number | null
  puerta: string | null
  puertaActiva: boolean | null
  total: number
  authorized: number
  denied: number
  pending: number
  lastSeen: Date | null
}

export type ReaderActivityRow = {
  lectorId: number | null
  lector: string | null
  lectorIp: string | null
  lectorActivo: boolean | null
  total: number
  authorized: number
  denied: number
  pending: number
  lastSeen: Date | null
}

export type MovementTypeSummaryRow = {
  tipo: string
  total: number
  authorized: number
  denied: number
  pending: number
}

export type DecisionReasonRow = {
  label: string
  total: number
}

export type DecisionCodeRow = {
  code: string
  total: number
}

const WINDOW_DAYS = 30
const RECENT_LIMIT = 75
const SUMMARY_LIMIT = 15

export async function getReportsDataForTenant(tenant: string, filters?: { from?: string | null, to?: string | null }) {
  // Construir condiciones de fecha
  let whereDate = ''
  const params: any[] = []
  if (filters?.from) {
    params.push(filters.from)
    whereDate += ` AND m.ts >= $${params.length}`
  }
  if (filters?.to) {
    params.push(filters.to)
    whereDate += ` AND m.ts <= $${params.length}`
  }

  const [daily, recent, personas, objetos, puertas, lectores, tipos, reasons, codes] = await Promise.all([
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
          WHERE 1=1${whereDate || ` AND m.ts >= now() - interval '${WINDOW_DAYS} days'`}
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT ${WINDOW_DAYS}
       )
       SELECT to_char(day, 'YYYY-MM-DD') AS day,
              total,
              authorized,
              denied,
              GREATEST(total - authorized - denied, 0)::int AS pending
         FROM daily
        ORDER BY day DESC`,
      params,
      tenant,
    ),
    query<RecentReportRow>(
      `SELECT m.id,
              m.ts,
              m.epc,
              per.id AS persona_id,
              COALESCE(per.nombre, m.extra->'accessControl'->'decision'->'persona'->>'nombre') AS persona,
              per.rfid_epc AS persona_epc,
              per.habilitado AS persona_habilitada,
              obj.id AS objeto_id,
              COALESCE(obj.nombre, m.extra->'accessControl'->'decision'->'objeto'->>'nombre') AS objeto,
              obj.tipo AS objeto_tipo,
              obj.estado AS objeto_estado,
              door.id AS puerta_id,
              COALESCE(door.nombre, m.extra->'accessControl'->'decision'->'puerta'->>'nombre') AS puerta,
              door.activa AS puerta_activa,
              lector.id AS lector_id,
              COALESCE(lector.nombre, m.extra->'accessControl'->'decision'->'lector'->>'nombre') AS lector,
              lector.ip AS lector_ip,
              lector.activo AS lector_activo,
              antena.id AS antena_id,
              COALESCE(
                m.extra->'accessControl'->'decision'->'antena'->>'nombre',
                CASE
                  WHEN antena.id IS NOT NULL THEN CONCAT('Antena ', COALESCE(antena.indice::text, antena.id::text))
                  ELSE NULL
                END
              ) AS antena,
              m.tipo,
              m.direccion,
              m.motivo,
              m.rssi,
              (m.extra->'accessControl'->'decision'->>'authorized')::boolean AS authorized,
              m.extra->'accessControl'->'decision'->>'reason' AS decision_reason,
              COALESCE(
                (
                  SELECT array_agg(DISTINCT elem)
                  FROM jsonb_array_elements_text(m.extra->'accessControl'->'decision'->'codes') AS elem
                ),
                ARRAY[]::text[]
              ) AS decision_codes,
              COALESCE(
                (
                  SELECT array_agg(DISTINCT note)
                  FROM jsonb_array_elements_text(m.extra->'accessControl'->'decision'->'notes') AS note
                ),
                ARRAY[]::text[]
              ) AS decision_notes
         FROM movimientos m
         LEFT JOIN personas per ON per.id = m.persona_id
         LEFT JOIN objetos obj ON obj.id = m.objeto_id
         LEFT JOIN puertas door ON door.id = m.puerta_id
         LEFT JOIN rfid_lectores lector ON lector.id = m.lector_id
         LEFT JOIN rfid_antenas antena ON antena.id = m.antena_id
        WHERE 1=1${whereDate || ` AND m.ts >= now() - interval '${WINDOW_DAYS} days'`}
        ORDER BY m.ts DESC
        LIMIT ${RECENT_LIMIT}`,
      params,
      tenant,
    ),
    query<PersonaActivityRow>(
      `SELECT per.id AS persona_id,
              COALESCE(per.nombre, m.extra->'accessControl'->'decision'->'persona'->>'nombre', 'Sin persona') AS persona,
              per.rfid_epc AS persona_epc,
              per.habilitado AS persona_habilitada,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
              COUNT(*) FILTER (
                WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                   OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
              )::int AS denied,
              GREATEST(
                COUNT(*)
                  - COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)
                  - COUNT(*) FILTER (
                      WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                         OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                    ),
                0
              )::int AS pending,
              MAX(m.ts) AS last_seen
         FROM movimientos m
         LEFT JOIN personas per ON per.id = m.persona_id
        WHERE 1=1${whereDate || ` AND m.ts >= now() - interval '${WINDOW_DAYS} days'`}
        GROUP BY per.id, persona, per.rfid_epc, per.habilitado
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      params,
      tenant,
    ),
    query<ObjectActivityRow>(
      `SELECT obj.id AS objeto_id,
              COALESCE(obj.nombre, m.extra->'accessControl'->'decision'->'objeto'->>'nombre', 'Sin objeto') AS objeto,
              obj.tipo AS objeto_tipo,
              obj.estado AS objeto_estado,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
              COUNT(*) FILTER (
                WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                   OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
              )::int AS denied,
              GREATEST(
                COUNT(*)
                  - COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)
                  - COUNT(*) FILTER (
                      WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                         OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                    ),
                0
              )::int AS pending,
              MAX(m.ts) AS last_seen
         FROM movimientos m
         LEFT JOIN objetos obj ON obj.id = m.objeto_id
        WHERE 1=1${whereDate || ` AND m.ts >= now() - interval '${WINDOW_DAYS} days'`}
        GROUP BY obj.id, objeto, obj.tipo, obj.estado
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      params,
      tenant,
    ),
    // ...el resto igual, solo cambia el WHERE agregando whereDate
              COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
              COUNT(*) FILTER (
                WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                   OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
              )::int AS denied,
              GREATEST(
                COUNT(*)
                  - COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)
                  - COUNT(*) FILTER (
                      WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                         OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                    ),
                0
              )::int AS pending,
              MAX(m.ts) AS last_seen
         FROM movimientos m
         LEFT JOIN puertas door ON door.id = m.puerta_id
        WHERE m.ts >= now() - interval '${WINDOW_DAYS} days'
        GROUP BY door.id, puerta, door.activa
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      undefined,
      tenant,
    ),
    query<ReaderActivityRow>(
      `SELECT lector.id AS lector_id,
              COALESCE(lector.nombre, m.extra->'accessControl'->'decision'->'lector'->>'nombre', 'Sin lector') AS lector,
              lector.ip AS lector_ip,
              lector.activo AS lector_activo,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
              COUNT(*) FILTER (
                WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                   OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
              )::int AS denied,
              GREATEST(
                COUNT(*)
                  - COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)
                  - COUNT(*) FILTER (
                      WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                         OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                    ),
                0
              )::int AS pending,
              MAX(m.ts) AS last_seen
         FROM movimientos m
         LEFT JOIN rfid_lectores lector ON lector.id = m.lector_id
        WHERE m.ts >= now() - interval '${WINDOW_DAYS} days'
        GROUP BY lector.id, lector, lector.ip, lector.activo
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      undefined,
      tenant,
    ),
    query<MovementTypeSummaryRow>(
      `SELECT COALESCE(m.tipo, 'Sin tipo') AS tipo,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
              COUNT(*) FILTER (
                WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                   OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
              )::int AS denied,
              GREATEST(
                COUNT(*)
                  - COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)
                  - COUNT(*) FILTER (
                      WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                         OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                    ),
                0
              )::int AS pending
         FROM movimientos m
        WHERE m.ts >= now() - interval '${WINDOW_DAYS} days'
        GROUP BY 1
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      undefined,
      tenant,
    ),
    query<DecisionReasonRow>(
      `SELECT COALESCE(m.extra->'accessControl'->'decision'->>'reason', 'Sin razón registrada') AS label,
              COUNT(*)::int AS total
         FROM movimientos m
        WHERE m.ts >= now() - interval '${WINDOW_DAYS} days'
        GROUP BY 1
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      undefined,
      tenant,
    ),
    query<DecisionCodeRow>(
      `SELECT codes.code,
              COUNT(*)::int AS total
         FROM movimientos m
         CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(m.extra->'accessControl'->'decision'->'codes', '[]'::jsonb)) AS codes(code)
        WHERE m.ts >= now() - interval '${WINDOW_DAYS} days'
        GROUP BY codes.code
        ORDER BY total DESC
        LIMIT ${SUMMARY_LIMIT}`,
      undefined,
      tenant,
    ),
  ])

  return {
    daily,
    recent,
    personas,
    objetos,
    puertas,
    lectores,
    tipos,
    decisionReasons: reasons,
    decisionCodes: codes,
  }
}
