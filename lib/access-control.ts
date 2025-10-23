import { query } from "@/lib/db"
import { sendFx9600Pulse } from "@/lib/fx9600"
import type {
  AccessControlEvaluationResult,
  AccessControlEntitySource,
  AccessControlMappingSummary,
  AccessControlGpoAction,
  AccessControlDecision,
  AccessControlSources,
} from "@/types/access-control"

const allowedObjectStates = (process.env.ACCESS_ALLOWED_OBJECT_STATES ?? "activo,active,en_servicio")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const requireAssignment = (process.env.ACCESS_REQUIRE_ASSIGNMENT ?? "true").toLowerCase() !== "false"

const DEFAULT_DENY_REASON = "No se encontró entidad autorizada para el EPC"

const debounceState = new Map<number, { lastSuccessMs: number }>()

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeState(state: string | null | undefined) {
  return state ? state.toLowerCase().trim() : null
}

function isObjectStateAllowed(state: string | null | undefined) {
  if (!state) return false
  return allowedObjectStates.includes(normalizeState(state) ?? "")
}

type PersonaRow = {
  id: number
  nombre: string | null
  habilitado: boolean
  habilitado_desde: Date | null
  habilitado_hasta: Date | null
  rfid_epc: string | null
}

type ObjetoRow = {
  id: number
  nombre: string | null
  tipo: string | null
  estado: string | null
  rfid_epc: string | null
}

type AssignmentRow = {
  id: number
  persona_id: number
  objeto_id: number
  asignado_desde: Date | null
  asignado_hasta: Date | null
  observacion: string | null
}

type DoorRow = {
  id: number
  nombre: string | null
  activa: boolean | null
}

type ReaderRow = {
  id: number
  nombre: string | null
  ip: string | null
  activo: boolean | null
}

type AntenaRow = {
  id: number
  lector_id: number | null
  indice: number | null
  activa: boolean | null
}

type DoorIoMapRow = {
  id: number
  puerta_id: number | null
  lector_id: number | null
  antena_id: number | null
  gpo_pin: number | null
  mode: string | null
  pulse_ms: number | null
  post_state_low: boolean | null
  anti_rebote_ms: number | null
  activo: boolean
  created_at: Date | null
  updated_at: Date | null
}

type PersonaResolution = {
  row: PersonaRow | null
  source: AccessControlEntitySource
}

type ObjetoResolution = {
  row: ObjetoRow | null
  source: AccessControlEntitySource
}

type AntenaResolution = {
  row: AntenaRow | null
  source: AccessControlEntitySource
}

type DoorResolution = {
  row: DoorRow | null
  source: AccessControlEntitySource
}

type ReaderResolution = {
  row: ReaderRow | null
  source: AccessControlEntitySource
}

type MappingResolution = {
  row: DoorIoMapRow | null
  specificity: string | null
  source: AccessControlEntitySource
}

type AccessControlEvaluationInput = {
  epc: string
  personaId: number | null
  objetoId: number | null
  puertaId: number | null
  lectorId: number | null
  antenaId: number | null
}

function evaluatePersona(row: PersonaRow | null, now: Date, reasons: string[], codes: string[]) {
  if (!row) return true

  if (!row.habilitado) {
    reasons.push(`Persona ${row.nombre ?? row.id} deshabilitada`)
    codes.push("persona-disabled")
    return false
  }

  if (row.habilitado_desde && row.habilitado_desde > now) {
    reasons.push(`La persona ${row.nombre ?? row.id} aún no está habilitada (desde ${toIso(row.habilitado_desde)})`)
    codes.push("persona-window-not-started")
    return false
  }

  if (row.habilitado_hasta && row.habilitado_hasta < now) {
    reasons.push(`La habilitación de ${row.nombre ?? row.id} venció en ${toIso(row.habilitado_hasta)}`)
    codes.push("persona-window-expired")
    return false
  }

  return true
}

function evaluateObjeto(row: ObjetoRow | null, reasons: string[], codes: string[]) {
  if (!row) return true

  if (!isObjectStateAllowed(row.estado)) {
    reasons.push(`El objeto ${row.nombre ?? row.id} no está activo (estado: ${row.estado ?? "desconocido"})`)
    codes.push("objeto-inactive")
    return false
  }

  return true
}

function evaluateAssignment(row: AssignmentRow | null, now: Date, reasons: string[], codes: string[]) {
  if (!row) {
    if (requireAssignment) {
      reasons.push("La persona no tiene asignado este objeto en la tabla de asignaciones")
      codes.push("assignment-missing")
      return false
    }
    return true
  }

  const startsOk = !row.asignado_desde || row.asignado_desde <= now
  const endsOk = !row.asignado_hasta || row.asignado_hasta >= now

  if (!startsOk) {
    reasons.push(`La asignación inicia en ${toIso(row.asignado_desde)}`)
    codes.push("assignment-not-started")
    return false
  }

  if (!endsOk) {
    reasons.push(`La asignación venció en ${toIso(row.asignado_hasta)}`)
    codes.push("assignment-expired")
    return false
  }

  return true
}

function evaluateDoor(row: DoorRow | null, notes: string[], codes: string[]) {
  if (!row) return
  if (row.activa === false) {
    notes.push(`La puerta ${row.nombre ?? row.id} está marcada como inactiva`)
    codes.push("door-inactive")
  }
}

function evaluateReader(row: ReaderRow | null, notes: string[], codes: string[]) {
  if (!row) return
  if (row.activo === false) {
    notes.push(`El lector ${row.nombre ?? row.id} está inactivo`)
    codes.push("lector-inactive")
  }

  if (!row.ip) {
    notes.push(`El lector ${row.nombre ?? row.id} no tiene IP configurada`)
    codes.push("lector-missing-ip")
  }
}

function getDebounceInfo(mapping: DoorIoMapRow | null, nowMs: number) {
  if (!mapping) {
    return { enforced: false, remainingMs: null as number | null, lastSuccessAt: null as string | null }
  }

  const limit = mapping.anti_rebote_ms ?? null
  if (!limit || limit <= 0) {
    return { enforced: false, remainingMs: null, lastSuccessAt: null }
  }

  const state = debounceState.get(mapping.id)
  if (!state) {
    return { enforced: false, remainingMs: null, lastSuccessAt: null }
  }

  const elapsed = nowMs - state.lastSuccessMs
  const remaining = limit - elapsed

  if (remaining > 0) {
    return {
      enforced: true,
      remainingMs: remaining,
      lastSuccessAt: new Date(state.lastSuccessMs).toISOString(),
    }
  }

  return { enforced: false, remainingMs: null, lastSuccessAt: null }
}

function registerDebounceSuccess(mapping: DoorIoMapRow, nowMs: number) {
  debounceState.set(mapping.id, { lastSuccessMs: nowMs })
}

async function resolvePersona(epc: string, personaId: number | null, now: Date): Promise<PersonaResolution> {
  if (personaId !== null) {
    const [row] = await query<PersonaRow>(
      `SELECT id, nombre, habilitado, habilitado_desde, habilitado_hasta, rfid_epc
       FROM personas
       WHERE id = $1
       LIMIT 1`,
      [personaId],
    )

    if (row) {
      return { row, source: "payload" }
    }
  }

  if (!epc) {
    return { row: null, source: null }
  }

  const [directRow] = await query<PersonaRow>(
    `SELECT id, nombre, habilitado, habilitado_desde, habilitado_hasta, rfid_epc
     FROM personas
     WHERE rfid_epc = $1
     LIMIT 1`,
    [epc],
  )

  if (directRow) {
    return { row: directRow, source: "rfid" }
  }

  const [historyRow] = await query<PersonaRow>(
    `SELECT p.id,
            p.nombre,
            p.habilitado,
            p.habilitado_desde,
            p.habilitado_hasta,
            p.rfid_epc
     FROM persona_rfid_hist hist
     JOIN personas p ON p.id = hist.persona_id
     WHERE hist.rfid_epc = $1
       AND (hist.asignado_hasta IS NULL OR hist.asignado_hasta >= $2)
     ORDER BY hist.asignado_desde DESC NULLS LAST, hist.created_at DESC
     LIMIT 1`,
    [epc, now],
  )

  if (historyRow) {
    return { row: historyRow, source: "historial" }
  }

  return { row: null, source: null }
}

async function resolveObjeto(epc: string, objetoId: number | null): Promise<ObjetoResolution> {
  if (objetoId !== null) {
    const [row] = await query<ObjetoRow>(
      `SELECT id, nombre, tipo, estado, rfid_epc
       FROM objetos
       WHERE id = $1
       LIMIT 1`,
      [objetoId],
    )

    if (row) {
      return { row, source: "payload" }
    }
  }

  if (!epc) {
    return { row: null, source: null }
  }

  const [directRow] = await query<ObjetoRow>(
    `SELECT id, nombre, tipo, estado, rfid_epc
     FROM objetos
     WHERE rfid_epc = $1
     LIMIT 1`,
    [epc],
  )

  if (directRow) {
    return { row: directRow, source: "rfid" }
  }

  return { row: null, source: null }
}

async function resolveAssignment(personaId: number, objetoId: number, now: Date) {
  const [row] = await query<AssignmentRow>(
    `SELECT id, persona_id, objeto_id, asignado_desde, asignado_hasta, observacion
     FROM asignaciones_activos
     WHERE persona_id = $1 AND objeto_id = $2
     ORDER BY asignado_desde DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [personaId, objetoId],
  )

  if (!row) return null
  if (row.asignado_hasta && row.asignado_hasta < now) return row
  return row
}

async function resolveAntena(antenaId: number | null): Promise<AntenaResolution> {
  if (antenaId === null) {
    return { row: null, source: null }
  }

  const [row] = await query<AntenaRow>(
    `SELECT id, lector_id, indice, activa
     FROM rfid_antenas
     WHERE id = $1
     LIMIT 1`,
    [antenaId],
  )

  return row ? { row, source: "payload" } : { row: null, source: null }
}

async function resolveDoorFromAntenna(antenaId: number | null): Promise<number | null> {
  if (antenaId === null) return null

  const [row] = await query<{ puerta_id: number }>(
    `SELECT puerta_id
     FROM puerta_antena
     WHERE antena_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [antenaId],
  )

  return row?.puerta_id ?? null
}

async function resolveDoor(puertaId: number | null, source: AccessControlEntitySource): Promise<DoorResolution> {
  if (puertaId === null) {
    return { row: null, source: null }
  }

  const [row] = await query<DoorRow>(
    `SELECT id, nombre, activa
     FROM puertas
     WHERE id = $1
     LIMIT 1`,
    [puertaId],
  )

  return row ? { row, source } : { row: null, source: null }
}

async function resolveReader(lectorId: number | null, source: AccessControlEntitySource): Promise<ReaderResolution> {
  if (lectorId === null) {
    return { row: null, source: null }
  }

  const [row] = await query<ReaderRow>(
    `SELECT id, nombre, ip, activo
     FROM rfid_lectores
     WHERE id = $1
     LIMIT 1`,
    [lectorId],
  )

  return row ? { row, source } : { row: null, source: null }
}

function computeSpecificity(row: DoorIoMapRow | null, puertaId: number | null, lectorId: number | null, antenaId: number | null) {
  if (!row) return null
  const parts: string[] = []

  parts.push(
    row.puerta_id === null
      ? "puerta:*"
      : puertaId === null
        ? `puerta:${row.puerta_id}`
        : row.puerta_id === puertaId
          ? "puerta:exact"
          : `puerta:${row.puerta_id}`,
  )

  parts.push(
    row.lector_id === null
      ? "lector:*"
      : lectorId === null
        ? `lector:${row.lector_id}`
        : row.lector_id === lectorId
          ? "lector:exact"
          : `lector:${row.lector_id}`,
  )

  parts.push(
    row.antena_id === null
      ? "antena:*"
      : antenaId === null
        ? `antena:${row.antena_id}`
        : row.antena_id === antenaId
          ? "antena:exact"
          : `antena:${row.antena_id}`,
  )

  return parts.join("|")
}

async function resolveMapping(puertaId: number | null, lectorId: number | null, antenaId: number | null): Promise<MappingResolution> {
  const [row] = await query<DoorIoMapRow>(
    `SELECT id,
            puerta_id,
            lector_id,
            antena_id,
            gpo_pin,
            mode,
            pulse_ms,
            post_state_low,
            anti_rebote_ms,
            activo,
            created_at,
            updated_at
     FROM door_io_map
     WHERE activo = true
       AND ($1::int IS NULL OR puerta_id IS NULL OR puerta_id = $1)
       AND ($2::int IS NULL OR lector_id IS NULL OR lector_id = $2)
       AND ($3::int IS NULL OR antena_id IS NULL OR antena_id = $3)
     ORDER BY
       CASE
         WHEN $1::int IS NULL THEN CASE WHEN puerta_id IS NULL THEN 0 ELSE 1 END
         WHEN puerta_id = $1 THEN 0
         WHEN puerta_id IS NULL THEN 1
         ELSE 2
       END,
       CASE
         WHEN $2::int IS NULL THEN CASE WHEN lector_id IS NULL THEN 0 ELSE 1 END
         WHEN lector_id = $2 THEN 0
         WHEN lector_id IS NULL THEN 1
         ELSE 2
       END,
       CASE
         WHEN $3::int IS NULL THEN CASE WHEN antena_id IS NULL THEN 0 ELSE 1 END
         WHEN antena_id = $3 THEN 0
         WHEN antena_id IS NULL THEN 1
         ELSE 2
       END,
       updated_at DESC NULLS LAST,
       created_at DESC
     LIMIT 1`,
    [puertaId, lectorId, antenaId],
  )

  if (!row) {
    return { row: null, specificity: null, source: null }
  }

  const specificity = computeSpecificity(row, puertaId, lectorId, antenaId)
  return { row, specificity, source: "mapping" }
}

function buildDecision(
  now: Date,
  persona: PersonaRow | null,
  objeto: ObjetoRow | null,
  assignment: AssignmentRow | null,
  puerta: DoorRow | null,
  lector: ReaderRow | null,
  antena: AntenaRow | null,
  personaSource: AccessControlEntitySource,
  objetoSource: AccessControlEntitySource,
  puertaSource: AccessControlEntitySource,
  lectorSource: AccessControlEntitySource,
  antenaSource: AccessControlEntitySource,
) {
  const denyReasons: string[] = []
  const codes: string[] = []
  const notes: string[] = []

  if (!persona && !objeto) {
    denyReasons.push(DEFAULT_DENY_REASON)
    codes.push("missing-entity")
  }

  const personaOk = evaluatePersona(persona, now, denyReasons, codes)
  const objetoOk = evaluateObjeto(objeto, denyReasons, codes)
  const assignmentOk = persona && objeto ? evaluateAssignment(assignment, now, denyReasons, codes) : true

  evaluateDoor(puerta, notes, codes)
  evaluateReader(lector, notes, codes)

  const authorized = denyReasons.length === 0 && personaOk && objetoOk && assignmentOk

  const reason = denyReasons.length
    ? `Acceso denegado: ${denyReasons.join("; ")}`
    : `Acceso concedido${notes.length ? ` (Notas: ${notes.join("; ")})` : ""}`

  const decision: AccessControlDecision = {
    authorized,
    reason,
    codes,
    notes,
    persona: persona
      ? {
        id: persona.id,
        nombre: persona.nombre,
        habilitado: persona.habilitado,
        habilitadoDesde: toIso(persona.habilitado_desde),
        habilitadoHasta: toIso(persona.habilitado_hasta),
        source: personaSource,
      }
      : undefined,
    objeto: objeto
      ? {
        id: objeto.id,
        nombre: objeto.nombre,
        tipo: objeto.tipo,
        estado: objeto.estado,
        source: objetoSource,
      }
      : undefined,
    assignment: assignment
      ? {
        id: assignment.id,
        activa: evaluateAssignment(assignment, now, [], []) && (!assignment.asignado_hasta || assignment.asignado_hasta >= now),
        asignadoDesde: toIso(assignment.asignado_desde),
        asignadoHasta: toIso(assignment.asignado_hasta),
        observacion: assignment.observacion ?? null,
      }
      : undefined,
    puerta: puerta
      ? {
        id: puerta.id,
        nombre: puerta.nombre,
        activa: puerta.activa,
        source: puertaSource,
      }
      : undefined,
    lector: lector
      ? {
        id: lector.id,
        nombre: lector.nombre,
        ip: lector.ip,
        activo: lector.activo,
        source: lectorSource,
      }
      : undefined,
    antena: antena
      ? {
        id: antena.id,
        indice: antena.indice,
        activa: antena.activa,
        lectorId: antena.lector_id,
        source: antenaSource,
      }
      : undefined,
  }

  return decision
}

function buildMappingSummary(mapping: DoorIoMapRow | null, specificity: string | null): AccessControlMappingSummary | null {
  if (!mapping) return null
  return {
    id: mapping.id,
    puertaId: mapping.puerta_id,
    lectorId: mapping.lector_id,
    antenaId: mapping.antena_id,
    gpoPin: mapping.gpo_pin,
    mode: mapping.mode,
    pulseMs: mapping.pulse_ms,
    postStateLow: mapping.post_state_low,
    antiReboteMs: mapping.anti_rebote_ms,
    activo: mapping.activo,
    specificity,
  }
}

async function buildGpoAction(
  decision: AccessControlDecision,
  mapping: DoorIoMapRow | null,
  reader: ReaderRow | null,
  nowMs: number,
): Promise<AccessControlGpoAction> {
  const debounceInfo = getDebounceInfo(mapping, nowMs)

  const base: AccessControlGpoAction = {
    attempted: false,
    status: "skipped",
    message: null,
    error: null,
    statusCode: null,
    readerIp: reader?.ip ?? null,
    url: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    pin: mapping?.gpo_pin ?? null,
    mode: mapping?.mode ?? null,
    pulseMs: mapping?.pulse_ms ?? null,
    postStateLow: mapping?.post_state_low ?? null,
    antiReboteMs: mapping?.anti_rebote_ms ?? null,
    debounce: debounceInfo.enforced
      ? {
        enforced: true,
        remainingMs: debounceInfo.remainingMs,
        lastSuccessAt: debounceInfo.lastSuccessAt,
      }
      : {
        enforced: false,
        remainingMs: null,
        lastSuccessAt: debounceInfo.lastSuccessAt,
      },
  }

  if (!decision.authorized) {
    base.message = decision.reason ?? "Evento no autorizado"
    return base
  }

  if (!mapping) {
    base.message = "Sin mapeo IO activo para este evento"
    return base
  }

  if (!mapping.activo) {
    base.message = "El mapeo IO está desactivado"
    return base
  }

  if (mapping.gpo_pin === null) {
    base.message = "El mapeo IO no tiene PIN configurado"
    return base
  }

  if (!reader || !reader.ip) {
    base.message = "No se encontró IP del lector para enviar el pulso"
    return base
  }

  const mode = (mapping.mode ?? "PULSE").toString().toLowerCase()
  const isPulseMode = mode === "pulse" || mode === "pulso"

  if (!isPulseMode) {
    base.message = `Modo GPO no soportado (${mapping.mode ?? "desconocido"})`
    return base
  }

  if (debounceInfo.enforced) {
    base.message = `Anti-rebote activo, esperar ${Math.ceil((debounceInfo.remainingMs ?? 0) / 100) / 10}s`
    base.status = "skipped"
    return base
  }

  const result = await sendFx9600Pulse({
    readerIp: reader.ip!,
    username: process.env.FX9600_USERNAME,
    password: process.env.FX9600_PASSWORD,
    gpoPin: mapping.gpo_pin,
    pulseMs: mapping.pulse_ms ?? undefined,
    postStateLow: mapping.post_state_low ?? undefined,
    mode: mapping.mode ?? undefined,
  })

  base.attempted = true
  base.status = result.success ? "success" : "error"
  base.statusCode = result.status
  base.message = result.message
  base.error = result.success ? null : result.error
  base.url = result.url
  base.startedAt = result.startedAt
  base.finishedAt = result.finishedAt
  base.durationMs = result.durationMs

  if (result.success && mapping) {
    registerDebounceSuccess(mapping, nowMs)
    base.debounce = {
      enforced: true,
      remainingMs: mapping.anti_rebote_ms ?? null,
      lastSuccessAt: result.finishedAt,
    }
  }

  return base
}

export async function evaluateAccessControl(input: AccessControlEvaluationInput): Promise<AccessControlEvaluationResult> {
  const now = new Date()
  const nowMs = now.getTime()
  const evaluatedAt = now.toISOString()

  let personaId = input.personaId ?? null
  let objetoId = input.objetoId ?? null
  let puertaId = input.puertaId ?? null
  let lectorId = input.lectorId ?? null
  let antenaId = input.antenaId ?? null
  let puertaSource: AccessControlEntitySource = input.puertaId !== null ? "payload" : null
  let lectorSource: AccessControlEntitySource = input.lectorId !== null ? "payload" : null
  let antenaSource: AccessControlEntitySource = input.antenaId !== null ? "payload" : null

  const [personaResolution, objetoResolution] = await Promise.all([
    resolvePersona(input.epc, personaId, now),
    resolveObjeto(input.epc, objetoId),
  ])

  const persona = personaResolution.row
  if (persona && personaId === null) {
    personaId = persona.id
  }

  const objeto = objetoResolution.row
  if (objeto && objetoId === null) {
    objetoId = objeto.id
  }

  const assignment = persona && objeto ? await resolveAssignment(persona.id, objeto.id, now) : null

  const antenaResolution = await resolveAntena(antenaId)
  const antena = antenaResolution.row
  if (antena && antenaId === null) {
    antenaId = antena.id
  }
  if (antenaResolution.source) {
    antenaSource = antenaResolution.source
  }

  if (!lectorId && antena?.lector_id) {
    lectorId = antena.lector_id
    lectorSource = "antena"
  }

  if (!puertaId) {
    const doorFromAntenna = await resolveDoorFromAntenna(antenaId)
    if (doorFromAntenna) {
      puertaId = doorFromAntenna
      puertaSource = "puerta-antena"
    }
  }

  const mappingResolution = await resolveMapping(puertaId, lectorId, antenaId)
  const mapping = mappingResolution.row

  if (mapping) {
    if (!puertaId && mapping.puerta_id) {
      puertaId = mapping.puerta_id
      puertaSource = "mapping"
    }
    if (!lectorId && mapping.lector_id) {
      lectorId = mapping.lector_id
      lectorSource = "mapping"
    }
    if (!antenaId && mapping.antena_id) {
      antenaId = mapping.antena_id
      antenaSource = "mapping"
    }
  }

  const doorResolution = await resolveDoor(puertaId, puertaSource)
  const puerta = doorResolution.row

  let lector: ReaderRow | null = null
  if (lectorId !== null) {
    const resolved = await resolveReader(lectorId, lectorSource)
    lector = resolved.row
    if (resolved.source) {
      lectorSource = resolved.source
    }
  }

  const decision = buildDecision(
    now,
    persona,
    objeto,
    assignment,
    puerta,
    lector,
    antena,
    personaResolution.source,
    objetoResolution.source,
    puertaSource,
    lectorSource,
    antenaSource,
  )

  const mappingSummary = buildMappingSummary(mapping, mappingResolution.specificity)
  const gpoAction = await buildGpoAction(decision, mapping, lector, nowMs)

  const sources: AccessControlSources = {
    persona: personaResolution.source,
    objeto: objetoResolution.source,
    puerta: puertaSource,
    lector: lectorSource,
    antena: antenaSource,
    mapping: mappingResolution.source,
  }

  return {
    audit: {
      evaluatedAt,
      decision,
      mapping: mappingSummary,
      gpo: gpoAction,
      sources,
    },
    resolvedIds: {
      personaId,
      objetoId,
      puertaId,
      lectorId,
      antenaId,
    },
  }
}
