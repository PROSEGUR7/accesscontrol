export type Key = {
  id: number
  nombre: string
  tipo: string
  descripcion: string | null
  rfidEpc: string | null
  estado: "activo" | "baja" | "extraviado"
  propietarioId: number | null
  propietarioNombre: string | null
  zonaActual: string | null
  codigoActivo: string | null
  categoria: string | null
  marca: string | null
  modelo: string | null
  serial: string | null
  valor: number | null
  fechaCompra: string | null
  vidaUtilMeses: number | null
  centroCosto: string | null
  custodioId: number | null
  custodioNombre: string | null
  ubicacionId: number | null
  ubicacionNombre: string | null
  createdAt: string
  updatedAt: string
}
