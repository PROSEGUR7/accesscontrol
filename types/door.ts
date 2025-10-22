export type Door = {
  id: number
  nombre: string
  descripcion: string | null
  ubicacion: string | null
  activa: boolean
  createdAt: string
  updatedAt: string
  ultimoEvento?: string | null
  estado?: string | null
}
