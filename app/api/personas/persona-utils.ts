import type { Person } from "@/types/person"

export const PERSON_COLUMNS = `id,
  nombre,
  documento,
  rfid_epc,
  habilitado,
  habilitado_desde,
  habilitado_hasta,
  created_at,
  updated_at`

export type PersonRow = {
  id: number
  nombre: string
  documento: string | null
  rfid_epc: string | null
  habilitado: boolean
  habilitado_desde: Date | null
  habilitado_hasta: Date | null
  created_at: Date
  updated_at: Date
}

function formatDate(value: Date | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function mapPerson(row: PersonRow): Person {
  return {
    id: Number(row.id),
    nombre: row.nombre,
    documento: row.documento,
    rfidEpc: row.rfid_epc,
    habilitado: Boolean(row.habilitado),
    habilitadoDesde: formatDate(row.habilitado_desde),
    habilitadoHasta: formatDate(row.habilitado_hasta),
    createdAt: formatDate(row.created_at)!,
    updatedAt: formatDate(row.updated_at)!,
  }
}
