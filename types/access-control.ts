export type AccessControlEntitySource =
  | "payload"
  | "rfid"
  | "historial"
  | "puerta-antena"
  | "mapping"
  | "antena"
  | "lector"
  | "default"
  | "desconocido"
  | null

export type AccessControlPersonSummary = {
  id: number
  nombre: string | null
  habilitado: boolean
  habilitadoDesde: string | null
  habilitadoHasta: string | null
  source: AccessControlEntitySource
}

export type AccessControlObjectSummary = {
  id: number
  nombre: string | null
  tipo: string | null
  estado: string | null
  source: AccessControlEntitySource
}

export type AccessControlAssignmentSummary = {
  id: number
  activa: boolean
  asignadoDesde: string | null
  asignadoHasta: string | null
  observacion: string | null
}

export type AccessControlDoorSummary = {
  id: number
  nombre: string | null
  activa: boolean | null
  source: AccessControlEntitySource
}

export type AccessControlReaderSummary = {
  id: number
  nombre: string | null
  ip: string | null
  activo: boolean | null
  source: AccessControlEntitySource
}

export type AccessControlAntennaSummary = {
  id: number
  indice: number | null
  activa: boolean | null
  lectorId: number | null
  source: AccessControlEntitySource
}

export type AccessControlDecision = {
  authorized: boolean | null
  reason: string | null
  codes: string[]
  notes: string[]
  persona?: AccessControlPersonSummary
  objeto?: AccessControlObjectSummary
  assignment?: AccessControlAssignmentSummary
  puerta?: AccessControlDoorSummary
  lector?: AccessControlReaderSummary
  antena?: AccessControlAntennaSummary
}

export type AccessControlMappingSummary = {
  id: number
  puertaId: number | null
  lectorId: number | null
  antenaId: number | null
  gpoPin: number | null
  mode: string | null
  pulseMs: number | null
  postStateLow: boolean | null
  antiReboteMs: number | null
  activo: boolean
  specificity: string | null
}

export type AccessControlDebounceInfo = {
  enforced: boolean
  remainingMs: number | null
  lastSuccessAt: string | null
}

export type AccessControlGpoAction = {
  attempted: boolean
  status: "success" | "error" | "skipped"
  message: string | null
  error: string | null
  statusCode: number | null
  readerIp: string | null
  url: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  pin: number | null
  mode: string | null
  pulseMs: number | null
  postStateLow: boolean | null
  antiReboteMs: number | null
  debounce: AccessControlDebounceInfo | null
}

export type AccessControlSources = {
  persona: AccessControlEntitySource
  objeto: AccessControlEntitySource
  puerta: AccessControlEntitySource
  lector: AccessControlEntitySource
  antena: AccessControlEntitySource
  mapping: AccessControlEntitySource
}

export type AccessControlAudit = {
  evaluatedAt: string
  decision: AccessControlDecision
  mapping: AccessControlMappingSummary | null
  gpo: AccessControlGpoAction
  sources: AccessControlSources
}

export type AccessControlResolvedIds = {
  personaId: number | null
  objetoId: number | null
  puertaId: number | null
  lectorId: number | null
  antenaId: number | null
}

export type AccessControlEvaluationResult = {
  audit: AccessControlAudit
  resolvedIds: AccessControlResolvedIds
}
