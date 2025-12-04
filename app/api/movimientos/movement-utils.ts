import type { AccessControlAudit } from "@/types/access-control"
import type { Movement } from "@/types/movement"

export const MOVEMENT_COLUMNS = `m.id,
  m.ts,
  m.tipo,
  m.epc,
  m.persona_id,
  per.nombre AS persona_nombre,
  m.objeto_id,
  obj.nombre AS objeto_nombre,
  m.puerta_id,
  door.nombre AS puerta_nombre,
  m.lector_id,
  lector.nombre AS lector_nombre,
  m.antena_id,
  ant.indice AS antena_indice,
  m.rssi,
  m.direccion,
  m.motivo,
  m.extra,
  m.created_at,
  stats.read_count::int AS read_count,
  stats.last_seen`

export function buildMovementFromClause(source = "movimientos m") {
  return `FROM ${source}
  LEFT JOIN personas per ON per.id = m.persona_id
  LEFT JOIN objetos obj ON obj.id = m.objeto_id
  LEFT JOIN puertas door ON door.id = m.puerta_id
  LEFT JOIN rfid_lectores lector ON lector.id = m.lector_id
  LEFT JOIN rfid_antenas ant ON ant.id = m.antena_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS read_count, MAX(ts) AS last_seen
    FROM movimientos
    WHERE epc = m.epc
  ) stats ON true`
}

export type MovementRow = {
  id: number
  ts: Date
  tipo: string | null
  epc: string | null
  persona_id: number | null
  persona_nombre: string | null
  objeto_id: number | null
  objeto_nombre: string | null
  puerta_id: number | null
  puerta_nombre: string | null
  lector_id: number | null
  lector_nombre: string | null
  antena_id: number | null
  antena_indice: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
  created_at: Date
  read_count: number | null
  last_seen: Date | null
}

function toIso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function extractAccessControl(extra: unknown): AccessControlAudit | null {
  if (!extra || typeof extra !== "object") return null
  const container = extra as { accessControl?: unknown }
  const candidate = container.accessControl
  if (!candidate || typeof candidate !== "object") return null
  return candidate as AccessControlAudit
}

export function mapMovement(row: MovementRow): Movement {
  const accessControl = extractAccessControl(row.extra)
  const decision = accessControl?.decision
  const gpo = accessControl?.gpo

  return {
    id: Number(row.id),
    timestamp: toIso(row.ts) ?? new Date().toISOString(),
    tipo: row.tipo,
    epc: row.epc,
    personaId: row.persona_id === null ? null : Number(row.persona_id),
    personaNombre: row.persona_nombre,
    objetoId: row.objeto_id === null ? null : Number(row.objeto_id),
    objetoNombre: row.objeto_nombre,
    puertaId: row.puerta_id === null ? null : Number(row.puerta_id),
    puertaNombre: row.puerta_nombre,
    lectorId: row.lector_id === null ? null : Number(row.lector_id),
    lectorNombre: row.lector_nombre,
    antenaId: row.antena_id === null ? null : Number(row.antena_id),
    antenaIndice: row.antena_indice === null ? null : Number(row.antena_indice),
    rssi: row.rssi === null ? null : Number(row.rssi),
    direccion: row.direccion,
    motivo: row.motivo,
    extra: row.extra,
    readCount: row.read_count === null ? null : Number(row.read_count),
    lastSeen: toIso(row.last_seen),
    accessControl,
    autorizado: typeof decision?.authorized === "boolean" ? decision.authorized : null,
    decisionMotivo: decision?.reason ?? null,
    decisionCodigos: decision?.codes ?? null,
    decisionNotas: decision?.notes ?? null,
    gpoPin: gpo?.pin ?? null,
    gpoMode: gpo?.mode ?? null,
    gpoResultado: gpo?.status ?? null,
    gpoMensaje: gpo?.message ?? gpo?.error ?? null,
    gpoStatusCode: gpo?.statusCode ?? null,
    gpoDuracionMs: gpo?.durationMs ?? null,
  }
}

type MaybeString = string | null | undefined
type MaybeNumber = number | string | null | undefined
type MaybeDateInput = string | number | Date | null | undefined
function toNullableString(value: MaybeString) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNullableNumber(value: MaybeNumber) {
  if (value == null) return null
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toTimestamp(value: MaybeDateInput) {
  if (value == null) {
    return new Date()
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Marca de tiempo inválida")
  }
  return date
}

function normalizeExtra(value: unknown) {
  if (value == null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  return value
}

export type MovementPayloadInput = {
  timestamp?: MaybeDateInput
  tipo?: MaybeString
  epc: string
  personaId?: MaybeNumber
  objetoId?: MaybeNumber
  puertaId?: MaybeNumber
  lectorId?: MaybeNumber
  antenaId?: MaybeNumber
  rssi?: MaybeNumber
  direccion?: MaybeString
  motivo?: MaybeString
  extra?: unknown
}

export type NormalizedMovementPayload = {
  ts: Date
  tipo: string | null
  epc: string
  personaId: number | null
  objetoId: number | null
  puertaId: number | null
  lectorId: number | null
  antenaId: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
}

export function normalizeMovementPayload(input: MovementPayloadInput): NormalizedMovementPayload {
  const ts = toTimestamp(input.timestamp)
  const epc = (input.epc ?? "").trim().toUpperCase()
  if (!epc) {
    throw new Error("El EPC es obligatorio")
  }

  return {
    ts,
    tipo: toNullableString(input.tipo ?? null),
    epc,
    personaId: toNullableNumber(input.personaId ?? null),
    objetoId: toNullableNumber(input.objetoId ?? null),
    puertaId: toNullableNumber(input.puertaId ?? null),
    lectorId: toNullableNumber(input.lectorId ?? null),
    antenaId: toNullableNumber(input.antenaId ?? null),
    rssi: toNullableNumber(input.rssi ?? null),
    direccion: toNullableString(input.direccion ?? null),
    motivo: toNullableString(input.motivo ?? null),
    extra: normalizeExtra(input.extra),
  }
}
