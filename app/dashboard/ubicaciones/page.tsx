"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { MapPin, MapPinPlus } from "lucide-react"

import { LocationsTable } from "@/components/locations/locations-table"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/formatters"
import type { Location } from "@/types/location"
import { locationFormSchema, type LocationFormValues } from "./location-form-schema"

const defaultValues: LocationFormValues = {
  nombre: "",
  tipo: undefined,
  descripcion: undefined,
  activa: true,
}

function locationToFormValues(location: Location): LocationFormValues {
  return {
    nombre: location.nombre,
    tipo: location.tipo ?? undefined,
    descripcion: location.descripcion ?? undefined,
    activa: location.activa,
  }
}

function sortLocations(list: Location[]) {
  return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues,
  })

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/ubicaciones", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Respuesta no válida del servidor")
      }
      const data = (await response.json()) as { ubicaciones?: Location[] }
      setLocations(sortLocations(data.ubicaciones ?? []))
    } catch (error) {
      console.error("Error al cargar ubicaciones", error)
      toast({
        variant: "destructive",
        title: "No se pudieron cargar las ubicaciones",
        description: "Revisa la conexión o intenta nuevamente.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false)
    setEditingLocation(null)
    form.reset(defaultValues)
  }, [form])

  const openCreateSheet = useCallback(() => {
    setEditingLocation(null)
    form.reset(defaultValues)
    setIsSheetOpen(true)
  }, [form])

  const openEditSheet = useCallback((location: Location) => {
    setEditingLocation(location)
    form.reset(locationToFormValues(location))
    setIsSheetOpen(true)
  }, [form])

  const handleView = useCallback((location: Location) => {
    const details = [
      location.tipo ? `Tipo: ${location.tipo}` : null,
      location.descripcion ? `Descripción: ${location.descripcion}` : null,
      `Estado: ${location.activa ? "Activa" : "Inactiva"}`,
      `Creada: ${formatDateTime(location.createdAt)}`,
    ].filter(Boolean).join(" · ")

    toast({
      title: location.nombre,
      description: details || "Sin detalles adicionales",
    })
  }, [])

  const handleDelete = useCallback(async (location: Location) => {
    if (processingId !== null) return

    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(`Eliminar la ubicación "${location.nombre}"?`)

    if (!confirmed) return

    setProcessingId(location.id)
    try {
      const response = await fetch(`/api/ubicaciones/${location.id}`, { method: "DELETE" })
      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { ubicacion?: Location; error?: string }) : {}
      if (!response.ok || !parsed.ubicacion) {
        throw new Error(parsed.error ?? "No se pudo eliminar la ubicación")
      }

      setLocations((current) => current.filter((item) => item.id !== location.id))

      toast({
        title: "Ubicación eliminada",
        description: `${location.nombre} fue eliminada correctamente`,
      })
    } catch (error) {
      console.error("Error al eliminar ubicación", error)
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: (error as Error).message,
      })
    } finally {
      setProcessingId(null)
    }
  }, [processingId])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        nombre: values.nombre.trim(),
        activa: values.activa,
      }

      if (values.tipo && values.tipo.trim()) {
        payload.tipo = values.tipo.trim()
      }

      if (values.descripcion && values.descripcion.trim()) {
        payload.descripcion = values.descripcion.trim()
      }

      const isEditing = Boolean(editingLocation)
      const requestUrl = isEditing && editingLocation
        ? `/api/ubicaciones/${editingLocation.id}`
        : "/api/ubicaciones"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(requestUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { ubicacion?: Location; error?: string }) : {}
      const ubicacion = parsed.ubicacion

      if (!response.ok || !ubicacion) {
        throw new Error(parsed.error ?? (isEditing ? "No se pudo actualizar la ubicación" : "No se pudo registrar la ubicación"))
      }

      setLocations((current) => {
        if (isEditing) {
          return sortLocations(current.map((item) => (item.id === ubicacion.id ? ubicacion : item)))
        }
        return sortLocations([ubicacion, ...current])
      })

      toast({
        title: isEditing ? "Ubicación actualizada" : "Ubicación registrada",
        description: `${ubicacion.nombre} se guardó correctamente`,
      })

      closeSheet()
    } catch (error) {
      console.error("Error al guardar ubicación", error)
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

  const total = locations.length
  const activeCount = useMemo(() => locations.filter((loc) => loc.activa).length, [locations])
  const inactiveCount = total - activeCount

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPinPlus className="size-5" /> Mapa de ubicaciones
            </CardTitle>
            <CardDescription>{total === 1 ? "1 ubicación registrada" : `${total} ubicaciones registradas`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Total</p>
                <p className="text-foreground text-2xl font-semibold">{total}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Activas</p>
                <p className="text-foreground text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Inactivas</p>
                <p className="text-foreground text-2xl font-semibold">{inactiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Ubicaciones registradas</CardTitle>
              <CardDescription>Gestiona las ubicaciones y mantén actualizado el mapa de activos.</CardDescription>
            </div>
            <Button onClick={openCreateSheet} disabled={submitting} className="lg:ml-auto">
              <MapPin className="mr-2 size-4" /> Registrar ubicación
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <LocationsTable data={[]} loading formatDate={formatDateTime} />
            ) : locations.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MapPinPlus className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No hay ubicaciones registradas</EmptyTitle>
                  <EmptyDescription>Registra la primera ubicación para comenzar a mapear tus activos.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateSheet} variant="outline">
                    Registrar ubicación
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <LocationsTable
                data={locations}
                onView={handleView}
                onEdit={openEditSheet}
                onDelete={handleDelete}
                formatDate={formatDateTime}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingLocation ? "Editar ubicación" : "Registrar ubicación"}</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-6 py-6">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Bóveda principal" {...field} value={field.value ?? ""} />
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
                      <Input placeholder="Ej. Oficina, Bodega" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Detalles adicionales" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activa"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Ubicación activa</FormLabel>
                      <p className="text-muted-foreground text-sm">Desactívala si está fuera de servicio.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Guardando..." : editingLocation ? "Guardar cambios" : "Registrar ubicación"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </>
  )
}
