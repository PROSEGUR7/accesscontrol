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

const fallbackActivity: ActivityItem[] = [
  {
    id: "fallback-1",
    title: "Juan Pérez",
    subtitle: "Puerta Principal",
    time: "Hace 2 minutos",
    badgeLabel: "Acceso concedido",
    variant: "outline" as const,
  },
  {
    id: "fallback-2",
    title: "María García",
    subtitle: "Laboratorio A",
    time: "Hace 5 minutos",
  badgeLabel: "Acceso concedido",
  variant: "outline" as const,
  },
  {
    id: "fallback-3",
    title: "Carlos López",
    subtitle: "Sala de Servidores",
    time: "Hace 8 minutos",
    badgeLabel: "Acceso denegado",
    variant: "destructive" as const,
  },
  {
    id: "fallback-4",
    title: "Ana Martínez",
    subtitle: "Oficina 201",
    time: "Hace 12 minutos",
  badgeLabel: "Acceso concedido",
  variant: "outline" as const,
  },
  {
    id: "fallback-5",
    title: "Pedro Sánchez",
    subtitle: "Almacén",
    time: "Hace 15 minutos",
  badgeLabel: "Acceso concedido",
  variant: "outline" as const,
  },
]

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
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
    : fallbackActivity

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
                <CardDescription>
                  {events.length ? "Lecturas en tiempo real desde los lectores FX9600" : "Últimos eventos registrados"}
                </CardDescription>
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
          </CardHeader>
          <CardContent className="space-y-4">
            {activityItems.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
                <Badge
                  variant={event.variant === "destructive" ? "destructive" : "outline"}
                  className={
                    event.variant === "destructive"
                      ? "border-red-500 bg-red-500/10 text-red-500"
                      : "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  }
                >
                  {event.badgeLabel}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
