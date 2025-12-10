"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ArrowLeftRight, CheckCircle2, Download, RefreshCw, ShieldX } from "lucide-react"

import { MovementsTable } from "@/components/movements/movements-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useRfidStream } from "@/hooks/use-rfid-stream"
import { toast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { Door } from "@/types/door"
import type { Key } from "@/types/key"
import type { Movement } from "@/types/movement"
import type { Person } from "@/types/person"
import { movementFormSchema, type MovementFormValues } from "./movement-form-schema"

const UNASSIGNED_VALUE = "__none__"
const PAGE_SIZE = 25

type MovementFilters = {
  search: string
  status: "all" | "authorized" | "denied" | "pending"
  from: string
  to: string
}

const defaultFilters: MovementFilters = {
  search: "",
  status: "all",
  from: "",
  to: "",
}

function toDateTimeLocal(value?: string | null) {
  const base = value ? new Date(value) : new Date()
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date()
    return new Date(fallback.getTime() - fallback.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  const adjusted = new Date(base.getTime() - base.getTimezoneOffset() * 60000)
  return adjusted.toISOString().slice(0, 16)
}

function createDefaultValues(): MovementFormValues {
  return {
    timestamp: toDateTimeLocal(),
    tipo: undefined,
    epc: "",
    personaId: undefined,
    objetoId: undefined,
    puertaId: undefined,
    lectorId: undefined,
    antenaId: undefined,
    rssi: undefined,
    direccion: undefined,
    motivo: undefined,
    extra: undefined,
  }
}

function movementToFormValues(movement: Movement): MovementFormValues {
  return {
    timestamp: toDateTimeLocal(movement.timestamp),
    tipo: movement.tipo ?? undefined,
    epc: movement.epc ?? "",
    personaId: movement.personaId ?? undefined,
    objetoId: movement.objetoId ?? undefined,
    puertaId: movement.puertaId ?? undefined,
    lectorId: movement.lectorId ?? undefined,
    antenaId: movement.antenaId ?? undefined,
    rssi: movement.rssi ?? undefined,
    direccion: movement.direccion ?? undefined,
    motivo: movement.motivo ?? movement.decisionMotivo ?? undefined,
    extra: movement.extra ? (typeof movement.extra === "string" ? movement.extra : JSON.stringify(movement.extra, null, 2)) : undefined,
  }
}

type ReferenceData = {
  personas: Person[]
  objetos: Key[]
  puertas: Door[]
}

type MovementsResponse = {
  movimientos?: Movement[]
  pagination?: {
    page?: number
    pageSize?: number
    total?: number
    totalPages?: number
  }
}

type PaginationState = {
  total: number
  totalPages: number
}

function sortMovements(movements: Movement[]) {
  return [...movements].sort((a, b) => {
    const current = new Date(b.timestamp).getTime()
    const previous = new Date(a.timestamp).getTime()
    return current - previous
  })
}

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<MovementFilters>(defaultFilters)
  const [searchInput, setSearchInput] = useState(defaultFilters.search)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationState>({ total: 0, totalPages: 1 })
  const [references, setReferences] = useState<ReferenceData>({ personas: [], objetos: [], puertas: [] })
  const [loadingReferences, setLoadingReferences] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Movement | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const liveRefreshRef = useRef(0)
  const { events: liveEvents, connected: liveConnected } = useRfidStream()
  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: createDefaultValues(),
  })

  const loadMovements = useCallback(
    async (pageToLoad: number, filtersSnapshot: MovementFilters, options?: { silent?: boolean }) => {
      const params = new URLSearchParams()
      params.set("page", pageToLoad.toString())
      params.set("pageSize", PAGE_SIZE.toString())

      const trimmedSearch = filtersSnapshot.search.trim()
      if (trimmedSearch) {
        params.set("search", trimmedSearch)
      }

      if (filtersSnapshot.status !== "all") {
        params.set("status", filtersSnapshot.status)
      }

      if (filtersSnapshot.from) {
        params.set("from", filtersSnapshot.from)
      }

      if (filtersSnapshot.to) {
        params.set("to", filtersSnapshot.to)
      }

      const setLoadingState = (value: boolean) => {
        if (options?.silent) {
          setRefreshing(value)
        } else {
          setLoading(value)
        }
      }

      setLoadingState(true)
      try {
        const response = await fetch(`/api/movimientos?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Respuesta no válida del servidor")
        }

        const data = (await response.json()) as MovementsResponse
        const incoming = Array.isArray(data.movimientos) ? data.movimientos : []
        setMovements(sortMovements(incoming))

        const nextPagination: PaginationState = {
          total: data.pagination?.total ?? incoming.length,
          totalPages: data.pagination?.totalPages ?? 1,
        }
        setPagination(nextPagination)

        const resolvedPage = data.pagination?.page ?? Math.min(pageToLoad, nextPagination.totalPages)
        setPage(resolvedPage)
      } catch (error) {
        console.error("Error al cargar movimientos", error)
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "No se pudieron cargar los movimientos",
            description: "Revisa la conexión o intenta nuevamente.",
          })
        }
      } finally {
        setLoadingState(false)
      }
    },
    [toast],
  )


  const applyFilters = useCallback((partial: Partial<MovementFilters>) => {
    setFilters((previous) => {
      const next = { ...previous, ...partial }
      setPage(1)
      void loadMovements(1, next)
      return next
    })
  }, [loadMovements])

  const resetFilters = useCallback(() => {
    setSearchInput(defaultFilters.search)
    setFilters(() => {
      const next = { ...defaultFilters }
      setPage(1)
      void loadMovements(1, next)
      return next
    })
  }, [loadMovements])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput === filters.search) return
      applyFilters({ search: searchInput })
    }, 400)

    return () => clearTimeout(handler)
  }, [searchInput, filters.search, applyFilters])

  const filtersAreDirty = useMemo(() => {
    return Boolean(filters.search.trim() || filters.from || filters.to || filters.status !== "all")
  }, [filters])

  const handleStatusChange = useCallback((value: MovementFilters["status"]) => {
    applyFilters({ status: value })
  }, [applyFilters])

  const handleDateChange = useCallback((key: "from" | "to", value: string) => {
    applyFilters({ [key]: value } as Partial<MovementFilters>)
  }, [applyFilters])

  const handlePageChange = useCallback((nextPage: number) => {
    if (nextPage === page) return
    if (nextPage < 1 || nextPage > pagination.totalPages) return
    setPage(nextPage)
    void loadMovements(nextPage, filters)
  }, [page, filters, pagination.totalPages, loadMovements])

  useEffect(() => {
    if (!liveEvents.length) return
    if (page !== 1) return
    if (filters.search.trim() || filters.status !== "all" || filters.from || filters.to) return

    const now = Date.now()
    if (now - liveRefreshRef.current < 4000) return
    liveRefreshRef.current = now

    void loadMovements(1, filters, { silent: true })
  }, [liveEvents, filters, page, loadMovements])

  const loadReferences = useCallback(async () => {
    setLoadingReferences(true)
    try {
      const [peopleResponse, objectsResponse, doorsResponse] = await Promise.all([
        fetch("/api/personas", { cache: "no-store" }),
        fetch("/api/keys", { cache: "no-store" }),
        fetch("/api/puertas", { cache: "no-store" }),
      ])

      if (!peopleResponse.ok || !objectsResponse.ok || !doorsResponse.ok) {
        throw new Error("No se pudieron cargar las referencias")
      }

      const [peopleData, objectsData, doorsData] = await Promise.all([
        peopleResponse.json() as Promise<{ personas?: Person[] }>,
        objectsResponse.json() as Promise<{ objetos?: Key[] }>,
        doorsResponse.json() as Promise<{ puertas?: Door[] }>,
      ])

      setReferences({
        personas: peopleData.personas ?? [],
        objetos: objectsData.objetos ?? [],
        puertas: doorsData.puertas ?? [],
      })
    } catch (error) {
      console.error("Error al cargar datos auxiliares", error)
      toast({
        variant: "destructive",
        title: "No se pudieron cargar las referencias",
        description: "Intenta actualizar la página o verifica tu conexión.",
      })
    } finally {
      setLoadingReferences(false)
    }
  }, [])

  useEffect(() => {
    void loadMovements(1, defaultFilters)
    void loadReferences()
  }, [loadMovements, loadReferences])

  const resetForm = useCallback(() => {
    form.reset(createDefaultValues())
  }, [form])

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false)
    setEditingMovement(null)
    resetForm()
  }, [resetForm])

  const openEditSheet = useCallback((movement: Movement) => {
    setEditingMovement(movement)
    form.reset(movementToFormValues(movement))
    setIsSheetOpen(true)
  }, [form])

  const handleDeleteRequest = useCallback((movement: Movement) => {
    setDeleteTarget(movement)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setDeleteTarget(null)
  }, [])

  const handleView = useCallback((movement: Movement) => {
    const details = [
      movement.tipo ? `Tipo: ${movement.tipo}` : null,
      movement.direccion ? `Dirección: ${movement.direccion}` : null,
      movement.personaNombre ? `Persona: ${movement.personaNombre}` : null,
      movement.objetoNombre ? `Objeto: ${movement.objetoNombre}` : null,
      movement.puertaNombre ? `Puerta: ${movement.puertaNombre}` : null,
      typeof movement.autorizado === "boolean" ? `Autorizado: ${movement.autorizado ? "Sí" : "No"}` : null,
      movement.motivo ?? movement.decisionMotivo,
    ].filter(Boolean).join(" · ")

    toast({
      title: movement.epc ?? `Movimiento #${movement.id}`,
      description: details || "Sin detalles adicionales",
    })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (processingId !== null || !deleteTarget) return

    setProcessingId(deleteTarget.id)
    try {
      const response = await fetch(`/api/movimientos/${deleteTarget.id}`, { method: "DELETE" })
      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { movimiento?: Movement; error?: string }) : {}
      if (!response.ok || !parsed.movimiento) {
        throw new Error(parsed.error ?? "No se pudo eliminar el movimiento")
      }

      toast({
        title: "Movimiento eliminado",
        description: `Se eliminó el evento registrado el ${formatDateTime(deleteTarget.timestamp)}`,
      })

      void loadMovements(page, filters, { silent: true })
      closeDeleteDialog()
    } catch (error) {
      console.error("Error al eliminar movimiento", error)
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: (error as Error).message,
      })
    } finally {
      setProcessingId(null)
    }
  }, [processingId, deleteTarget, page, filters, loadMovements, closeDeleteDialog])

  const exportMovements = useCallback(async () => {
    if (!movements.length) {
      toast({
        title: "Sin datos para exportar",
        description: "Carga o filtra movimientos para generar el reporte.",
      })
      return
    }

    if (typeof window === "undefined") return

    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("pageSize", PAGE_SIZE.toString())

    const trimmedSearch = filters.search.trim()
    if (trimmedSearch) {
      params.set("search", trimmedSearch)
    }

    if (filters.status !== "all") {
      params.set("status", filters.status)
    }

    if (filters.from) {
      params.set("from", filters.from)
    }

    if (filters.to) {
      params.set("to", filters.to)
    }

    try {
      const response = await fetch(`/api/dashboard/movimientos/export?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("No se pudo generar la exportación")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `movimientos_${new Date().toISOString().replace(/[:]/g, "-")}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Exportación generada",
        description: "Se descargó un archivo Excel con los movimientos visibles.",
      })
    } catch (error) {
      console.error("Error al exportar movimientos", error)
      toast({
        variant: "destructive",
        title: "No se pudo exportar",
        description: "Intenta nuevamente en unos minutos.",
      })
    }
  }, [movements.length, filters, page, toast])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        timestamp: new Date(values.timestamp).toISOString(),
        epc: values.epc.trim(),
      }

      const optionalStrings: Array<[string | undefined | null, string]> = [
        [values.tipo, "tipo"],
        [values.direccion, "direccion"],
        [values.motivo, "motivo"],
      ]

      optionalStrings.forEach(([value, alias]) => {
        if (typeof value === "string") {
          const trimmed = value.trim()
          if (trimmed) {
            payload[alias] = trimmed
          }
        }
      })

      const optionalNumbers: Array<[number | null | undefined, string]> = [
        [values.personaId, "personaId"],
        [values.objetoId, "objetoId"],
        [values.puertaId, "puertaId"],
        [values.lectorId, "lectorId"],
        [values.antenaId, "antenaId"],
        [values.rssi, "rssi"],
      ]

      optionalNumbers.forEach(([value, alias]) => {
        if (typeof value === "number" && Number.isFinite(value)) {
          payload[alias] = value
        }
      })

      if (values.extra && values.extra.trim()) {
        const trimmed = values.extra.trim()
        try {
          payload.extra = JSON.parse(trimmed)
        } catch {
          payload.extra = trimmed
        }
      }

      const isEditing = Boolean(editingMovement)
      const requestUrl = isEditing && editingMovement
        ? `/api/movimientos/${editingMovement.id}`
        : "/api/movimientos"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(requestUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { movimiento?: Movement; error?: string }) : {}
      const movimiento = parsed.movimiento

      if (!response.ok || !movimiento) {
        throw new Error(parsed.error ?? (isEditing ? "No se pudo actualizar el movimiento" : "No se pudo registrar el movimiento"))
      }

      toast({
        title: isEditing ? "Movimiento actualizado" : "Movimiento registrado",
        description: `Evento del ${formatDateTime(movimiento.timestamp)} guardado correctamente`,
      })
      
      const targetPage = isEditing ? page : 1
      if (!isEditing) {
        setPage(1)
      }
      void loadMovements(targetPage, filters, { silent: isEditing })

      closeSheet()
    } catch (error) {
      console.error("Error al guardar movimiento", error)
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: (error as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  })

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setIsSheetOpen(true)
    } else {
      closeSheet()
    }
  }, [closeSheet])

  const filteredTotal = pagination.total
  const authorizedCount = useMemo(() => movements.filter((movement) => movement.autorizado === true).length, [movements])
  const deniedCount = useMemo(() => movements.filter((movement) => movement.autorizado === false).length, [movements])
  const showingStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingEnd = filteredTotal === 0 ? 0 : Math.min(page * PAGE_SIZE, filteredTotal)
  const deletingMovement = deleteTarget ? processingId === deleteTarget.id : false

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowLeftRight className="size-5" /> Resumen de movimientos
            </CardTitle>
            <CardDescription>Últimos eventos registrados en la plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Total</p>
                <p className="text-foreground text-2xl font-semibold">{filteredTotal}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Autorizados
                </div>
                <p className="text-foreground text-2xl font-semibold">{authorizedCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldX className="size-4 text-destructive" /> Denegados
                </div>
                <p className="text-foreground text-2xl font-semibold">{deniedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Historial de movimientos</CardTitle>
              <CardDescription>Consulta y gestiona los eventos registrados.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => void loadMovements(page, filters)}
                disabled={loading || refreshing}
              >
                <RefreshCw className={cn("mr-2 size-4", refreshing ? "animate-spin" : undefined)} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                onClick={exportMovements}
                disabled={loading || refreshing || movements.length === 0}
              >
                <Download className="mr-2 size-4" /> Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-lg border border-dashed p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Buscar</p>
                  <Input
                    placeholder="EPC, persona, objeto"
                    value={searchInput}
                    maxLength={24}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <Select value={filters.status} onValueChange={(value) => handleStatusChange(value as MovementFilters["status"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="authorized">Autorizados</SelectItem>
                      <SelectItem value="denied">Denegados</SelectItem>
                      <SelectItem value="pending">Sin decisión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Desde</p>
                  <Input type="date" value={filters.from} onChange={(event) => handleDateChange("from", event.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hasta</p>
                  <Input type="date" value={filters.to} onChange={(event) => handleDateChange("to", event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={resetFilters} disabled={!filtersAreDirty}>
                  Limpiar filtros
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex size-2 rounded-full",
                      liveConnected ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  {liveConnected ? "Tiempo real activo" : "Sin conexión en vivo"}
                </div>
                {refreshing ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="size-3 animate-spin" /> Actualizando tabla
                  </div>
                ) : null}
              </div>
            </div>

            {loading ? (
              <MovementsTable data={[]} loading formatDate={formatDateTime} />
            ) : movements.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ArrowLeftRight className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No hay movimientos registrados</EmptyTitle>
                  <EmptyDescription>Registra un movimiento manual o espera nuevos eventos del lector.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="text-sm text-muted-foreground">
                  Espera lecturas nuevas o revisa la conexión del lector para recibir eventos.
                </EmptyContent>
              </Empty>
            ) : (
              <MovementsTable
                data={movements}
                onView={handleView}
                onEdit={openEditSheet}
                onDelete={handleDeleteRequest}
                formatDate={formatDateTime}
              />
            )}

            {pagination.total > 0 ? (
              <div className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {showingStart}-{showingEnd} de {pagination.total} resultados
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || loading}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {page} de {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pagination.totalPages || loading}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{editingMovement ? "Editar movimiento" : "Registrar movimiento"}</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="timestamp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha y hora</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Input placeholder="Acceso concedido" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="epc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RFID EPC</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="300833B2DDD9..."
                          maxLength={24}
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const value = event.target.value.slice(0, 24).toUpperCase()
                            field.onChange(value)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Entrada / Salida" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="personaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Persona</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : UNASSIGNED_VALUE}
                        onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                        disabled={loadingReferences}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una persona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_VALUE}>Sin persona</SelectItem>
                          {references.personas.map((persona) => (
                            <SelectItem key={persona.id} value={persona.id.toString()}>
                              {persona.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="objetoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objeto</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : UNASSIGNED_VALUE}
                        onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                        disabled={loadingReferences}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un objeto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_VALUE}>Sin objeto</SelectItem>
                          {references.objetos.map((objeto) => (
                            <SelectItem key={objeto.id} value={objeto.id.toString()}>
                              {objeto.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="puertaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puerta</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : UNASSIGNED_VALUE}
                        onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                        disabled={loadingReferences}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una puerta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_VALUE}>Sin puerta</SelectItem>
                          {references.puertas.map((puerta) => (
                            <SelectItem key={puerta.id} value={puerta.id.toString()}>
                              {puerta.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="lectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lector</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="ID"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const value = event.target.value
                            field.onChange(value === "" ? undefined : Number(value))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="antenaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Antena</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="ID"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const value = event.target.value
                            field.onChange(value === "" ? undefined : Number(value))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rssi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RSSI</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="-65"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const value = event.target.value
                            field.onChange(value === "" ? undefined : Number(value))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo o resultado</FormLabel>
                    <FormControl>
                      <Input placeholder="Autorizado por asignación vigente" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="extra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payload extra (JSON opcional)</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="{ &quot;accessControl&quot;: { ... } }" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Guardando..." : editingMovement ? "Guardar cambios" : "Registrar movimiento"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) {
          closeDeleteDialog()
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar movimiento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el movimiento
              {deleteTarget ? ` registrado el ${formatDateTime(deleteTarget.timestamp)}` : ""}. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMovement || processingId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={!deleteTarget || deletingMovement || processingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMovement ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
