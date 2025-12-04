import type { Location } from "@/types/location"

export const LOCATION_COLUMNS = `id, nombre, tipo, descripcion, activa, created_at, updated_at`

export type LocationRow = {
  id: number
  nombre: string
  tipo: string | null
  descripcion: string | null
  activa: boolean
  created_at: Date
  updated_at: Date
}

type MaybeString = string | null | undefined

function toNullableString(value: MaybeString) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function mapLocation(row: LocationRow): Location {
  return {
    id: Number(row.id),
    nombre: row.nombre,
    tipo: row.tipo,
    descripcion: row.descripcion,
    activa: Boolean(row.activa),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  }
}

export type LocationPayloadInput = {
  nombre: string
  tipo?: MaybeString
  descripcion?: MaybeString
  activa?: boolean
}

export type NormalizedLocationPayload = {
  nombre: string
  tipo: string | null
  descripcion: string | null
  activa: boolean
}

export function normalizeLocationPayload(input: LocationPayloadInput): NormalizedLocationPayload {
  return {
    nombre: input.nombre.trim(),
    tipo: toNullableString(input.tipo ?? null),
    descripcion: toNullableString(input.descripcion ?? null),
    activa: input.activa ?? true,
  }
}
