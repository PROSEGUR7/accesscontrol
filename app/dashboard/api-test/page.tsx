"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRfidStream, type RfidEvent } from "@/hooks/use-rfid-stream"
import { cn } from "@/lib/utils"

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  })
}

function getSeverityVariant(event: RfidEvent) {
  const severity = `${event.tipo ?? ""} ${event.motivo ?? ""}`.toLowerCase()
  return severity.includes("deneg") || severity.includes("fall") || severity.includes("error")
    ? "destructive"
    : "outline"
}

function describeEvent(event: RfidEvent) {
  const pieces = [
    event.personaId ? `Persona #${event.personaId}` : null,
    event.objetoId ? `Objeto #${event.objetoId}` : null,
    event.puertaId ? `Puerta #${event.puertaId}` : null,
    event.lectorId ? `Lector #${event.lectorId}` : null,
    event.antenaId ? `Antena #${event.antenaId}` : null,
  ].filter(Boolean)

  return pieces.join(" · ") || "Sin metadatos"
}

export default function ApiTestPage() {
  const { events: liveEvents, connected, error, clear } = useRfidStream({ bufferSize: 100 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [initialEvents, setInitialEvents] = useState<RfidEvent[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchInitial = async () => {
      try {
        setInitialLoading(true)
        setInitialError(null)
        const response = await fetch("/api/rfid?limit=100")
        if (!response.ok) {
          throw new Error(`Error ${response.status}`)
        }
        const body = (await response.json()) as { movements?: RfidEvent[] }
        if (!cancelled) {
          setInitialEvents(Array.isArray(body.movements) ? body.movements : [])
        }
      } catch (err) {
        if (!cancelled) {
          setInitialError((err as Error).message)
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
        }
      }
    }

    void fetchInitial()

    return () => {
      cancelled = true
    }
  }, [])

  const events = useMemo(() => {
    const merged = [...liveEvents, ...initialEvents]
    const unique: RfidEvent[] = []
    const seen = new Set<number>()

    for (const event of merged) {
      if (event && typeof event.id === "number" && !seen.has(event.id)) {
        unique.push(event)
        seen.add(event.id)
      }
    }

    return unique
  }, [liveEvents, initialEvents])

  useEffect(() => {
    setSelectedIndex(0)
  }, [events.length])

  const lastEvent = events[0] ?? null
  const selectedEvent = events[selectedIndex] ?? null
  const formattedEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        severity: getSeverityVariant(event),
        formattedTimestamp: formatTimestamp(event.timestamp),
      })),
    [events],
  )

  const handlePurge = async () => {
    setActionError(null)
    setPurging(true)
    try {
      const response = await fetch("/api/rfid", { method: "DELETE" })
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const body = (await response.json()) as { ok?: boolean; deleted?: number }
      if (body.ok === false) {
        throw new Error("La API no pudo eliminar los registros")
      }
      clear()
      setInitialEvents([])
      setSelectedIndex(0)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={connected ? "outline" : "destructive"}
          className={
            connected
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
              : "border-red-500 bg-red-500/10 text-red-500"
          }
        >
          {connected ? "Socket conectado" : "Socket desconectado"}
        </Badge>
        {error ? <Badge variant="destructive">{error}</Badge> : null}
        {initialError ? <Badge variant="destructive">Historial: {initialError}</Badge> : null}
        {actionError ? <Badge variant="destructive">Acción: {actionError}</Badge> : null}
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          {events.length} evento{events.length === 1 ? "" : "s"} en buffer
        </Badge>
        {lastEvent ? (
          <span className="text-sm text-muted-foreground">
            Último evento: {formatTimestamp(lastEvent.timestamp)}
          </span>
        ) : null}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            void handlePurge()
          }}
          disabled={purging}
        >
          {purging ? "Eliminando..." : "Eliminar registros"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Eventos RFID en tiempo real</CardTitle>
            <CardDescription>
              Selecciona una fila para ver el detalle completo del evento procesado por la API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>EPC</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>RSSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedEvents.length ? (
                  formattedEvents.map((event, index) => (
                    <TableRow
                      key={`event-${event.id}-${event.timestamp}`}
                      onClick={() => setSelectedIndex(index)}
                      data-state={index === selectedIndex ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell>{event.formattedTimestamp}</TableCell>
                      <TableCell className="font-mono text-xs">{event.epc ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {describeEvent(event)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={event.severity === "destructive" ? "destructive" : "outline"}
                          className={cn(
                            event.severity === "destructive"
                              ? "border-red-500 bg-red-500/10 text-red-500"
                              : "border-emerald-500 bg-emerald-500/10 text-emerald-600",
                          )}
                        >
                          {event.tipo ?? "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.rssi ?? "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      {initialLoading
                        ? "Cargando historial de eventos guardados..."
                        : "Aún no hay eventos en el buffer. Envía un POST a `/api/rfid` para comenzar a recibir datos."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption>
                Mostrando hasta 100 eventos más recientes recibidos por el endpoint `/api/rfid`.
              </TableCaption>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Detalle del evento</CardTitle>
            <CardDescription>
              Información completa, incluyendo payload y metadatos asociados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEvent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">EPC:</span>
                  <span className="font-mono text-xs">{selectedEvent.epc ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{formatTimestamp(selectedEvent.timestamp)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Persona", value: selectedEvent.personaId },
                    { label: "Objeto", value: selectedEvent.objetoId },
                    { label: "Puerta", value: selectedEvent.puertaId },
                    { label: "Lector", value: selectedEvent.lectorId },
                    { label: "Antena", value: selectedEvent.antenaId },
                  ].map((item) => (
                    <Badge key={item.label} variant="secondary" className="bg-muted text-muted-foreground">
                      {item.label}: {item.value ?? "—"}
                    </Badge>
                  ))}
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <pre className="max-h-72 overflow-auto text-xs">
                    {JSON.stringify(selectedEvent, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un evento de la tabla para ver el detalle.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
