"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CirclePlus, DoorClosed } from "lucide-react"

import { DoorTable } from "@/components/doors/door-table"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/formatters"
import type { Door } from "@/types/door"
import { formSchema, type FormSchema } from "./door-form-schema"

const defaultDoorValues: FormSchema = {
  nombre: "",
  descripcion: "",
  ubicacion: "",
  activa: true,
}

function doorToFormValues(door: Door): FormSchema {
  return {
    nombre: door.nombre,
    descripcion: door.descripcion ?? "",
    ubicacion: door.ubicacion ?? "",
    activa: door.activa,
  }
}

function normalizeOptional(value: string | undefined) {
  if (value === undefined) return undefined
  return value.trim()
}

export default function DoorsPage() {
  const [doors, setDoors] = useState<Door[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [editingDoor, setEditingDoor] = useState<Door | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultDoorValues,
  })

  const loadDoors = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/puertas", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Respuesta no válida del servidor")
      }
      const data = (await response.json()) as { puertas?: Door[] }
      setDoors(data.puertas ?? [])
    } catch (error) {
      console.error("Error al cargar puertas", error)
      toast({
        variant: "destructive",
        title: "No se pudieron cargar las puertas",
        description: "Revisa la conexión o intenta nuevamente.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDoors()
  }, [loadDoors])

  const openCreateSheet = useCallback(() => {
    setEditingDoor(null)
    form.reset(defaultDoorValues)
    setIsSheetOpen(true)
  }, [form])

  const openEditSheet = useCallback((door: Door) => {
    setEditingDoor(door)
    form.reset(doorToFormValues(door))
    setIsSheetOpen(true)
  }, [form])

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false)
    setEditingDoor(null)
    form.reset(defaultDoorValues)
  }, [form])

  const handleView = useCallback((door: Door) => {
    const details = [
      door.descripcion,
      door.ubicacion ? `Ubicación: ${door.ubicacion}` : null,
      door.ultimoEvento ? `Último evento: ${door.ultimoEvento}` : null,
      `Estado: ${door.activa ? "Activa" : "Inactiva"}`,
    ].filter(Boolean).join(" · ")

    toast({
      title: door.nombre,
      description: details || "Sin información adicional",
    })
  }, [])

  const handleReorder = useCallback((next: Door[]) => {
    setDoors(next)
  }, [])

  const handleDelete = useCallback(async (door: Door) => {
    if (processingId !== null) return

    const confirmed = typeof window === "undefined" ? true : window.confirm(`Eliminar la puerta ${door.nombre}?`)
    if (!confirmed) return

    setProcessingId(door.id)
    try {
      const response = await fetch(`/api/puertas/${door.id}`, { method: "DELETE" })
      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { puerta?: Door; error?: string }) : {}
      if (!response.ok || !parsed.puerta) {
        throw new Error(parsed.error ?? "No se pudo eliminar la puerta")
      }

      setDoors((current) => current.filter((item) => item.id !== door.id))

      toast({
        title: "Puerta eliminada",
        description: `${door.nombre} fue eliminada correctamente`,
      })
    } catch (error) {
      console.error("Error al eliminar puerta", error)
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

      const descripcion = normalizeOptional(values.descripcion)
      if (descripcion !== undefined) {
        payload.descripcion = descripcion
      }

      const ubicacion = normalizeOptional(values.ubicacion)
      if (ubicacion !== undefined) {
        payload.ubicacion = ubicacion
      }

      const isEditing = Boolean(editingDoor)
      const requestUrl = isEditing && editingDoor ? `/api/puertas/${editingDoor.id}` : "/api/puertas"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(requestUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const raw = await response.text()
      const parsed = raw ? (JSON.parse(raw) as { puerta?: Door; error?: string }) : {}
      const puerta = parsed.puerta

      if (!response.ok || !puerta) {
        throw new Error(parsed.error ?? (isEditing ? "No se pudo actualizar la puerta" : "No se pudo registrar la puerta"))
      }

      setDoors((current) => {
        if (isEditing) {
          return current.map((item) => (item.id === puerta.id ? puerta : item))
        }
        return [puerta, ...current]
      })

      toast({
        title: isEditing ? "Puerta actualizada" : "Puerta registrada",
        description: `${puerta.nombre} se guardó correctamente`,
      })

      closeSheet()
    } catch (error) {
      console.error("Error al guardar puerta", error)
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

  const totalDoors = doors.length
  const activeCount = useMemo(() => doors.filter((door) => door.activa).length, [doors])
  const inactiveCount = totalDoors - activeCount

  const sheetTitle = editingDoor ? "Editar puerta" : "Registrar puerta"
  const sheetDescription = editingDoor
    ? "Actualiza los datos de la puerta seleccionada."
    : "Completa la información para registrar una nueva puerta."

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DoorClosed className="size-5" /> Puertas
            </CardTitle>
            <CardDescription>
              {totalDoors === 1 ? "1 puerta registrada" : `${totalDoors} puertas registradas`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Activas</p>
                <p className="text-foreground text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Inactivas</p>
                <p className="text-foreground text-2xl font-semibold">{inactiveCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-muted-foreground text-sm">Última actualización</p>
                <p className="text-muted-foreground text-sm">
                  {doors[0] ? formatDateTime(doors[0].updatedAt) : "Sin registros"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Monitoreo de puertas</CardTitle>
              <CardDescription>Consulta y gestiona la información de cada puerta.</CardDescription>
            </div>
            <Button onClick={openCreateSheet} disabled={submitting} className="lg:ml-auto">
              <CirclePlus className="mr-2 size-4" /> Registrar puerta
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <DoorTable data={[]} loading formatDate={formatDateTime} />
            ) : doors.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <DoorClosed className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No hay puertas registradas</EmptyTitle>
                  <EmptyDescription>Registra la primera puerta para comenzar a monitorearlas.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateSheet} variant="outline">
                    Registrar puerta
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <DoorTable
                data={doors}
                onReorder={handleReorder}
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
        <SheetContent className="sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex h-full flex-col">
              <SheetHeader className="border-b pb-4">
                <SheetTitle>{sheetTitle}</SheetTitle>
                <SheetDescription>{sheetDescription}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Puerta Principal" {...field} value={field.value ?? ""} />
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
                          <Textarea placeholder="Detalles adicionales" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>Opcional, ayuda a identificar la puerta.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ubicacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Planta Baja" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="activa"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-0.5">
                          <FormLabel>Puerta activa</FormLabel>
                          <FormDescription>Controla si la puerta está disponible para monitoreo.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Marcar puerta activa" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <SheetFooter className="border-t">
                <div className="flex w-full items-center justify-between gap-2">
                  <SheetClose asChild>
                    <Button type="button" variant="outline" disabled={submitting} onClick={closeSheet}>
                      Cancelar
                    </Button>
                  </SheetClose>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner className="mr-2 size-4" /> Guardando...
                      </>
                    ) : (
                      editingDoor ? "Guardar cambios" : "Registrar puerta"
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </>
  )
}
