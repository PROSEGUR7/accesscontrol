import type { Key } from "@/types/key"

const envDefaultType = process.env.KEY_DEFAULT_TYPE?.trim()

export const KEY_DEFAULT_TYPE = envDefaultType && envDefaultType.length > 0 ? envDefaultType : "objeto"

export const KEY_COLUMNS = `o.id,
  o.nombre,
  o.tipo,
  o.descripcion,
  o.rfid_epc,
  o.estado,
  o.propietario_id,
  o.zona_actual,
  o.codigo_activo,
  o.categoria,
  o.marca,
  o.modelo,
  o.serial,
  o.valor,
  o.fecha_compra,
  o.vida_util_meses,
  o.centro_costo,
  o.custodio_id,
  o.ubicacion_id,
  o.created_at,
  o.updated_at,
  cust.nombre AS custodio_nombre,
  prop.nombre AS propietario_nombre,
  u.nombre AS ubicacion_nombre`

export type KeyRow = {
  id: number
  nombre: string
  tipo: string
  descripcion: string | null
  rfid_epc: string | null
  estado: string
  propietario_id: number | null
  zona_actual: string | null
  codigo_activo: string | null
  categoria: string | null
  marca: string | null
  modelo: string | null
  serial: string | null
  valor: string | null
  fecha_compra: Date | null
  vida_util_meses: number | null
  centro_costo: string | null
  custodio_id: number | null
  ubicacion_id: number | null
  created_at: Date
  updated_at: Date
  custodio_nombre: string | null
  propietario_nombre: string | null
  ubicacion_nombre: string | null
}

function formatDate(value: Date | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function formatNumber(value: string | null) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function mapKey(row: KeyRow): Key {
  const rawState = (row.estado ?? "activo").toLowerCase()
  const estado = rawState === "activo" || rawState === "baja" || rawState === "extraviado"
    ? (rawState as Key["estado"])
    : "activo"

  return {
    id: Number(row.id),
    nombre: row.nombre,
    tipo: row.tipo,
    descripcion: row.descripcion,
    rfidEpc: row.rfid_epc,
    estado,
    propietarioId: row.propietario_id === null ? null : Number(row.propietario_id),
    propietarioNombre: row.propietario_nombre,
    zonaActual: row.zona_actual,
    codigoActivo: row.codigo_activo,
    categoria: row.categoria,
    marca: row.marca,
    modelo: row.modelo,
    serial: row.serial,
    valor: formatNumber(row.valor),
    fechaCompra: formatDate(row.fecha_compra),
    vidaUtilMeses: row.vida_util_meses === null ? null : Number(row.vida_util_meses),
    centroCosto: row.centro_costo,
    custodioId: row.custodio_id === null ? null : Number(row.custodio_id),
    custodioNombre: row.custodio_nombre,
    ubicacionId: row.ubicacion_id === null ? null : Number(row.ubicacion_id),
    ubicacionNombre: row.ubicacion_nombre,
    createdAt: formatDate(row.created_at)!,
    updatedAt: formatDate(row.updated_at)!,
  }
}

type MaybeString = string | null | undefined
type MaybeNumber = number | null | undefined
type MaybeDateInput = string | Date | null | undefined

function toNullableString(value: MaybeString) {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNullableNumber(value: MaybeNumber) {
  if (value == null) return null
  return Number.isFinite(value) ? value : Number(value)
}

function toNullableDate(value: MaybeDateInput) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export type KeyPayloadInput = {
  nombre: string
  tipo?: MaybeString
  descripcion?: MaybeString
  rfidEpc?: MaybeString
  codigoActivo?: MaybeString
  estado: Key["estado"]
  propietarioId?: MaybeNumber
  custodioId?: MaybeNumber
  ubicacionId?: MaybeNumber
  zonaActual?: MaybeString
  categoria?: MaybeString
  marca?: MaybeString
  modelo?: MaybeString
  serial?: MaybeString
  valor?: MaybeNumber
  fechaCompra?: MaybeDateInput
  vidaUtilMeses?: MaybeNumber
  centroCosto?: MaybeString
}

export type NormalizedKeyPayload = {
  nombre: string
  tipo: string
  descripcion: string | null
  rfidEpc: string | null
  codigoActivo: string | null
  estado: Key["estado"]
  propietarioId: number | null
  custodioId: number | null
  ubicacionId: number | null
  zonaActual: string | null
  categoria: string | null
  marca: string | null
  modelo: string | null
  serial: string | null
  valor: number | null
  fechaCompra: Date | null
  vidaUtilMeses: number | null
  centroCosto: string | null
}

export function normalizeKeyPayload(input: KeyPayloadInput): NormalizedKeyPayload {
  const rawTipo = input.tipo ?? KEY_DEFAULT_TYPE
  const tipo = toNullableString(rawTipo) ?? KEY_DEFAULT_TYPE

  return {
    nombre: input.nombre.trim(),
    tipo,
    descripcion: toNullableString(input.descripcion ?? null),
    rfidEpc: toNullableString(input.rfidEpc ?? null),
    codigoActivo: toNullableString(input.codigoActivo ?? null),
    estado: input.estado,
    propietarioId: toNullableNumber(input.propietarioId ?? null),
    custodioId: toNullableNumber(input.custodioId ?? null),
    ubicacionId: toNullableNumber(input.ubicacionId ?? null),
    zonaActual: toNullableString(input.zonaActual ?? null),
    categoria: toNullableString(input.categoria ?? null),
    marca: toNullableString(input.marca ?? null),
    modelo: toNullableString(input.modelo ?? null),
    serial: toNullableString(input.serial ?? null),
    valor: toNullableNumber(input.valor ?? null),
    fechaCompra: toNullableDate(input.fechaCompra ?? null),
    vidaUtilMeses: toNullableNumber(input.vidaUtilMeses ?? null),
    centroCosto: toNullableString(input.centroCosto ?? null),
  }
}
