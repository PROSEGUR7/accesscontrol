"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useRfidStream } from "@/hooks/use-rfid-stream"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type ActivityItem = {
  id: string
  title: string
  subtitle: string
  time: string
  badgeLabel: string
  variant: "outline" | "destructive"
}

type MovementRow = {
  id: number
  timestamp: string
  tipo: string | null
  epc: string | null
  direccion: string | null
  motivo: string | null
  persona: string | null
  objeto: string | null
  puerta: string | null
}

type DashboardMetricsResponse = {
  stats: {
    accessesToday: { value: number; trend: number | null }
    activePeople: number
    monitoredDoors: number
    deniedToday: { value: number; trend: number | null }
  }
  chart: { day: string; total: number }[]
}

const chartConfig = {
  accesos: {
    label: "Accesos",
    color: "var(--primary)",
  },
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [history, setHistory] = useState<MovementRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const { events, connected, error } = useRfidStream({ bufferSize: 25 })

  useEffect(() => {
    const controller = new AbortController()

    async function loadMetrics() {
      try {
        setLoadingMetrics(true)
        setMetricsError(null)

        const response = await fetch("/api/dashboard/metrics", {
          method: "GET",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`metrics_request_failed_${response.status}`)
        }

        const data = (await response.json()) as DashboardMetricsResponse
        setMetrics(data)
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return
        console.error("Error loading dashboard metrics", fetchError)
        setMetricsError("No se pudieron cargar las métricas en tiempo real.")
      } finally {
        setLoadingMetrics(false)
      }
    }

    void loadMetrics()

    return () => {
      controller.abort()
    }
  }, [])

  const chartData = useMemo(() => {
    if (!metrics?.chart?.length) {
      return []
    }

    return metrics.chart.map((entry) => {
      const date = new Date(entry.day)
      const weekday = date.toLocaleDateString("es-MX", { weekday: "short" })
      const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)

      return {
        name: normalizedWeekday,
        accesos: entry.total,
      }
    })
  }, [metrics])

  const statCards = useMemo(() => {
    if (!metrics) {
      return []
    }

    const formatValue = (value: number) => value.toLocaleString("es-MX")

    const formatTrend = (trend: number | null, positiveIsGood: boolean) => {
      if (trend === null) {
        return {
          label: "Sin datos de comparación",
          variant: "muted" as const,
        }
      }

      const formatted = `${trend > 0 ? "+" : ""}${trend.toLocaleString("es-MX", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })}% vs ayer`

      const isPositive = trend >= 0
      const variant = positiveIsGood
        ? isPositive
          ? ("success" as const)
          : ("destructive" as const)
        : isPositive
          ? ("destructive" as const)
          : ("success" as const)

      return { label: formatted, variant }
    }

    const accessesTrend = formatTrend(metrics.stats.accessesToday.trend, true)
    const deniedTrend = formatTrend(metrics.stats.deniedToday.trend, false)

    return [
      {
        title: "Accesos Hoy",
        value: formatValue(metrics.stats.accessesToday.value),
        trend: accessesTrend.label,
        trendVariant: accessesTrend.variant,
      },
      {
        title: "Personal Activo",
        value: formatValue(metrics.stats.activePeople),
        trend: "Personal habilitado actualmente",
        trendVariant: "muted" as const,
      },
      {
        title: "Puertas Monitoreadas",
        value: formatValue(metrics.stats.monitoredDoors),
        trend: "Puertas activas en la red",
        trendVariant: "muted" as const,
      },
      {
        title: "Accesos Denegados",
        value: formatValue(metrics.stats.deniedToday.value),
        trend: deniedTrend.label,
        trendVariant: deniedTrend.variant,
      },
    ]
  }, [metrics])

  useEffect(() => {
    const controller = new AbortController()

    async function loadHistory() {
      try {
        setLoadingHistory(true)
        setHistoryError(null)

        const response = await fetch("/api/reports/list?type=todos&limit=15", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        })

        const raw = await response.text()
        const payload = raw ? (JSON.parse(raw) as { data?: MovementRow[]; message?: string }) : {}

        if (!response.ok) {
          throw new Error(payload.message || "No se pudieron cargar los eventos recientes.")
        }

        setHistory(payload.data ?? [])
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return
        console.error("Error loading recent movements", fetchError)
        setHistory([])
        setHistoryError((fetchError as Error).message)
      } finally {
        setLoadingHistory(false)
      }
    }

    void loadHistory()

    return () => {
      controller.abort()
    }
  }, [])

  const historyItems: ActivityItem[] = useMemo(() => {
    return history.map((row) => {
      const title = row.persona ?? row.objeto ?? row.epc ?? `Movimiento #${row.id}`

      const subtitleParts = [
        row.puerta ? `Puerta ${row.puerta}` : null,
        row.direccion ? `Dirección ${row.direccion}` : null,
      ].filter(Boolean)

      const subtitle = subtitleParts.join(" · ") || "Ubicación no disponible"

      const timestamp = new Date(row.timestamp)
      const timeLabel = Number.isNaN(timestamp.getTime())
        ? row.timestamp
        : timestamp.toLocaleString("es-ES")

      const statusSource = `${row.tipo ?? "Movimiento"}${row.motivo ? ` · ${row.motivo}` : ""}`
      const statusLabel = statusSource.trim() || "Movimiento registrado"

      const severitySource = `${row.tipo ?? ""} ${row.motivo ?? ""}`.toLowerCase()
      const isDestructive =
        severitySource.includes("deneg") || severitySource.includes("fall") || severitySource.includes("error")

      return {
        id: `movement-${row.id}`,
        title,
        subtitle,
        time: timeLabel,
        badgeLabel: statusLabel,
        variant: isDestructive ? "destructive" : "outline",
      }
    })
  }, [history])

  const activityItems: ActivityItem[] = events.length
    ? events.map((event) => {
        const descriptorParts = [
          event.direccion ? `Dirección ${event.direccion}` : null,
          event.puertaId ? `Puerta ${event.puertaId}` : null,
          event.lectorId ? `Lector ${event.lectorId}` : null,
          event.antenaId ? `Antena ${event.antenaId}` : null,
          event.rssi !== null ? `RSSI ${event.rssi}` : null,
        ].filter(Boolean)

        const descriptor = descriptorParts.join(" · ") || "Ubicación no disponible"

        const timestamp = new Date(event.timestamp)
        const timeLabel = Number.isNaN(timestamp.getTime())
          ? event.timestamp
          : timestamp.toLocaleString("es-ES")

        const statusSource = `${event.tipo ?? "Lectura"}${event.motivo ? ` · ${event.motivo}` : ""}`
        const statusLabel = statusSource.trim() || "Lectura registrada"

        const severitySource = `${event.tipo ?? ""} ${event.motivo ?? ""}`.toLowerCase()
        const isDestructive =
          severitySource.includes("deneg") || severitySource.includes("fall") || severitySource.includes("error")

        return {
          id: `rfid-${event.id}`,
          title: event.epc ?? "EPC desconocido",
          subtitle: descriptor,
          time: timeLabel,
          badgeLabel: statusLabel,
          variant: isDestructive ? "destructive" : "outline",
        }
      })
    : historyItems

  const activityLoading = !events.length && loadingHistory
  const activityError = !events.length ? historyError : null
  const activityDescription = events.length
    ? "Lecturas en tiempo real desde los lectores FX9600"
    : activityLoading
      ? "Consultando los últimos movimientos registrados"
      : historyItems.length
        ? "Últimos eventos guardados en la base de datos"
        : "No hay eventos registrados"

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loadingMetrics
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={`metrics-skeleton-${index}`} className="border-border/60">
                <CardHeader className="pb-0">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))
          : statCards.map((item) => (
              <Card key={item.title} className="border-border/60">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base font-medium text-muted-foreground">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {item.value}
                  </p>
                  <p
                    className={`text-xs ${
                      item.trendVariant === 'success'
                        ? 'text-emerald-500'
                        : item.trendVariant === 'destructive'
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {item.trend}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {metricsError ? <p className="text-sm text-red-500">{metricsError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Accesos por Día</CardTitle>
                <CardDescription>Últimos 7 días</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <div className="flex h-64 items-center justify-center">
                <Skeleton className="h-56 w-full" />
              </div>
            ) : chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64" key="accesses-chart">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar
                    dataKey="accesos"
                    radius={[8, 8, 4, 4]}
                    fill="var(--primary)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                Aún no hay lecturas registradas en los últimos días.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>{activityDescription}</CardDescription>
              </div>
              <Badge
                variant={connected ? "outline" : "destructive"}
                className={
                  connected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-red-500 bg-red-500/10 text-red-500"
                }
              >
                {connected ? "Tiempo real" : "Sin conexión"}
              </Badge>
            </div>
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            {activityError ? <p className="text-xs text-red-500">{activityError}</p> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {activityLoading ? (
              <ActivitySkeleton />
            ) : activityItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No se han registrado movimientos en los últimos días.
              </div>
            ) : (
              activityItems.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-semibold text-foreground" title={event.title}>
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground" title={event.subtitle}>
                          {event.subtitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {event.time}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={event.variant === "destructive" ? "destructive" : "outline"}
                        className={`${
                          event.variant === "destructive"
                            ? "border-red-500 bg-red-500/10 text-red-600"
                            : "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        } max-w-full whitespace-normal px-2 py-1 text-left text-xs leading-relaxed`}
                      >
                        {event.badgeLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
