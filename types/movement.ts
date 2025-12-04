import type { AccessControlAudit } from "./access-control"

export type Movement = {
  id: number
  timestamp: string
  tipo: string | null
  epc: string | null
  personaId: number | null
  personaNombre: string | null
  objetoId: number | null
  objetoNombre: string | null
  puertaId: number | null
  puertaNombre: string | null
  lectorId: number | null
  lectorNombre: string | null
  antenaId: number | null
  antenaIndice: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
  readCount: number | null
  lastSeen: string | null
  accessControl?: AccessControlAudit | null
  autorizado?: boolean | null
  decisionMotivo?: string | null
  decisionCodigos?: string[] | null
  decisionNotas?: string[] | null
  gpoPin?: number | null
  gpoMode?: string | null
  gpoResultado?: "success" | "error" | "skipped" | null
  gpoMensaje?: string | null
  gpoStatusCode?: number | null
  gpoDuracionMs?: number | null
}
