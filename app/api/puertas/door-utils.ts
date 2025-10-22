import type { Door } from "@/types/door"

export const DOOR_COLUMNS = `id,
  nombre,
  descripcion,
  ubicacion,
  activa,
  created_at,
  updated_at`

export type DoorRow = {
  id: number
  nombre: string
  descripcion: string | null
  ubicacion: string | null
  activa: boolean
  created_at: Date
  updated_at: Date
}

function formatDate(value: Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function mapDoor(row: DoorRow): Door {
  return {
    id: Number(row.id),
    nombre: row.nombre,
    descripcion: row.descripcion,
    ubicacion: row.ubicacion,
    activa: Boolean(row.activa),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  }
}
