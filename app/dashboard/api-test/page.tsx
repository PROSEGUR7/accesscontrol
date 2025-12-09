"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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
  if (event.autorizado === false) {
    return "destructive"
  }
  if (event.gpoResultado === "error") {
    return "destructive"
  }
  const severity = `${event.tipo ?? ""} ${event.motivo ?? ""}`.toLowerCase()
  return severity.includes("deneg") || severity.includes("fall") || severity.includes("error")
    ? "destructive"
    : "outline"
}

type EnrichedEvent = RfidEvent & {
  severity: "destructive" | "outline"
  formattedTimestamp: string
  readCount: number
  lastSeen: string | null
}

function describeEvent(event: EnrichedEvent) {
  const pieces = [
    typeof event.autorizado === "boolean" ? (event.autorizado ? "Autorizado" : "Denegado") : null,
    event.gpoResultado ? `GPO: ${event.gpoResultado}` : null,
    event.personaId ? `Persona #${event.personaId}` : null,
    event.objetoId ? `Objeto #${event.objetoId}` : null,
    event.puertaId ? `Puerta #${event.puertaId}` : null,
    event.lectorId ? `Lector #${event.lectorId}` : null,
    event.antenaId ? `Antena #${event.antenaId}` : null,
  ].filter(Boolean)

  const statsLabel = `Lecturas: ${event.readCount} · Última: ${event.lastSeen ? formatTimestamp(event.lastSeen) : "—"}`

  const motives = event.decisionMotivo ? [event.decisionMotivo] : []

  const description = [statsLabel, ...pieces, ...motives].filter(Boolean).join(" · ")

  return description || "Sin metadatos"
}

export default function ApiTestPage() {
  const { events: liveEvents, connected, error, clear } = useRfidStream({ bufferSize: 100 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [initialEvents, setInitialEvents] = useState<RfidEvent[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)
  const [statsVersion, setStatsVersion] = useState(0)
  const epcStatsRef = useRef(new Map<string, { count: number; lastSeen: string | null }>())
  const processedIdsRef = useRef(new Set<number>())

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
    const stats = epcStatsRef.current
    const processed = processedIdsRef.current
    let changed = false

    for (const event of events) {
      if (!event) continue

      const id = typeof event.id === "number" ? event.id : null
      const key = event.epc ?? "__missing__"
      const incomingCount = event.readCount ?? null
      const incomingLast = event.lastSeen ?? event.timestamp ?? null

      const existing = stats.get(key) ?? { count: 0, lastSeen: null as string | null }

      if (id !== null && processed.has(id)) {
        if (incomingCount !== null && incomingCount > existing.count) {
          existing.count = incomingCount
          changed = true
        }

        if (incomingLast) {
          if (!existing.lastSeen || new Date(incomingLast).getTime() > new Date(existing.lastSeen).getTime()) {
            existing.lastSeen = incomingLast
            changed = true
          }
        }

        stats.set(key, existing)
        continue
      }

      if (id !== null) {
        processed.add(id)
      }

      if (incomingCount !== null) {
        if (incomingCount > existing.count) {
          existing.count = incomingCount
          changed = true
        }
      } else {
        existing.count += 1
        changed = true
      }

      if (incomingLast) {
        if (!existing.lastSeen || new Date(incomingLast).getTime() > new Date(existing.lastSeen).getTime()) {
          existing.lastSeen = incomingLast
          changed = true
        }
      }

      stats.set(key, existing)
    }

    if (changed) {
      setStatsVersion((version) => version + 1)
    }
  }, [events])

  useEffect(() => {
    setSelectedIndex(0)
  }, [events.length])

  const formattedEvents = useMemo(() => {
    const stats = epcStatsRef.current

    return events.map((event) => {
      const key = event.epc ?? "__missing__"
      const stat = stats.get(key)
      const readCount = stat?.count ?? event.readCount ?? 1
      const lastSeen = stat?.lastSeen ?? event.lastSeen ?? event.timestamp ?? null

      return {
        ...event,
        severity: getSeverityVariant(event),
        formattedTimestamp: formatTimestamp(event.timestamp),
        readCount,
        lastSeen,
      }
    }) as EnrichedEvent[]
  }, [events, statsVersion])

  const lastEvent = events[0] ?? null
  const selectedEvent = formattedEvents[selectedIndex] ?? null

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
      epcStatsRef.current.clear()
      processedIdsRef.current.clear()
      setStatsVersion((version) => version + 1)
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
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[1040px] text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Hora</TableHead>
                    <TableHead className="whitespace-nowrap">EPC</TableHead>
                    <TableHead className="whitespace-nowrap">Descripción</TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap">Autorización</TableHead>
                    <TableHead className="whitespace-nowrap">GPO</TableHead>
                    <TableHead className="whitespace-nowrap">RSSI</TableHead>
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
                        <TableCell className="whitespace-nowrap">{event.formattedTimestamp}</TableCell>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap">{event.epc ?? "—"}</TableCell>
                        <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                          <span className="line-clamp-2">{describeEvent(event)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={event.severity === "destructive" ? "destructive" : "outline"}
                            className={cn(
                              event.severity === "destructive"
                                ? "border-red-500 bg-red-500/10 text-red-500"
                                : "border-emerald-500 bg-emerald-500/10 text-emerald-600",
                              "whitespace-nowrap",
                            )}
                          >
                            {event.tipo ?? "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={event.autorizado === false ? "destructive" : event.autorizado ? "outline" : "secondary"}
                            className={cn(
                              event.autorizado === false
                                ? "border-red-500 bg-red-500/10 text-red-500"
                                : event.autorizado
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                  : "border-muted bg-muted text-muted-foreground",
                              "whitespace-nowrap",
                            )}
                          >
                            {event.autorizado === null
                              ? "Pendiente"
                              : event.autorizado
                                ? "Permitido"
                                : "Denegado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={event.gpoResultado === "error" ? "destructive" : event.gpoResultado === "success" ? "outline" : "secondary"}
                            className={cn(
                              event.gpoResultado === "error"
                                ? "border-red-500 bg-red-500/10 text-red-500"
                                : event.gpoResultado === "success"
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                  : "border-muted bg-muted text-muted-foreground",
                              "whitespace-nowrap",
                            )}
                          >
                            {event.gpoResultado === "success"
                              ? "Pulso"
                              : event.gpoResultado === "error"
                                ? "Error"
                                : event.gpoResultado === "skipped"
                                  ? "Omitido"
                                  : "No aplica"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{event.rssi ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
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
            </div>
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
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Última lectura de este EPC:</span>
                  <span>{selectedEvent.lastSeen ? formatTimestamp(selectedEvent.lastSeen) : "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Lecturas registradas:</span>
                  <span>{selectedEvent.readCount}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Autorización:</span>
                  <Badge
                    variant={selectedEvent.autorizado === false ? "destructive" : selectedEvent.autorizado ? "outline" : "secondary"}
                    className={cn(
                      selectedEvent.autorizado === false
                        ? "border-red-500 bg-red-500/10 text-red-500"
                        : selectedEvent.autorizado
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : "border-muted bg-muted text-muted-foreground",
                    )}
                  >
                    {selectedEvent.autorizado === null
                      ? "Pendiente"
                      : selectedEvent.autorizado
                        ? "Permitido"
                        : "Denegado"}
                  </Badge>
                  {selectedEvent.decisionMotivo ? (
                    <span className="text-xs text-muted-foreground">{selectedEvent.decisionMotivo}</span>
                  ) : null}
                </div>
                {selectedEvent.decisionNotas && selectedEvent.decisionNotas.length ? (
                  <div className="text-xs text-muted-foreground">
                    Notas: {selectedEvent.decisionNotas.join(" · ")}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">GPO:</span>
                  <Badge
                    variant={selectedEvent.gpoResultado === "error" ? "destructive" : selectedEvent.gpoResultado === "success" ? "outline" : "secondary"}
                    className={cn(
                      selectedEvent.gpoResultado === "error"
                        ? "border-red-500 bg-red-500/10 text-red-500"
                        : selectedEvent.gpoResultado === "success"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : "border-muted bg-muted text-muted-foreground",
                    )}
                  >
                    {selectedEvent.gpoResultado === "success"
                      ? "Pulso"
                      : selectedEvent.gpoResultado === "error"
                        ? "Error"
                        : selectedEvent.gpoResultado === "skipped"
                          ? "Omitido"
                          : selectedEvent.gpoIntentado
                            ? "Sin datos"
                            : "No aplica"}
                  </Badge>
                  {selectedEvent.gpoMensaje ? (
                    <span className="text-xs text-muted-foreground">{selectedEvent.gpoMensaje}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Pin: {selectedEvent.gpoPin ?? "—"}</span>
                  <span>Modo: {selectedEvent.gpoMode ?? "—"}</span>
                  <span>
                    Intento: {selectedEvent.gpoIntentado === null || selectedEvent.gpoIntentado === undefined
                      ? "—"
                      : selectedEvent.gpoIntentado
                        ? "Sí"
                        : "No"}
                  </span>
                  <span>HTTP: {selectedEvent.gpoStatusCode ?? "—"}</span>
                  <span>Duración: {selectedEvent.gpoDuracionMs ? `${selectedEvent.gpoDuracionMs} ms` : "—"}</span>
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
                    {JSON.stringify(
                      {
                        ...selectedEvent,
                        severity: undefined,
                        formattedTimestamp: undefined,
                        readCount: undefined,
                        lastSeen: undefined,
                      },
                      null,
                      2,
                    )}
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
