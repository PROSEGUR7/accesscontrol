"use client"

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

type ActivityItem = {
  id: string
  title: string
  subtitle: string
  time: string
  badgeLabel: string
  variant: "outline" | "destructive"
}

const stats = [
  {
    title: "Accesos Hoy",
    value: "1,234",
    trend: "+12.5% desde ayer",
    trendVariant: "success" as const,
  },
  {
    title: "Personal Activo",
    value: "342",
    trend: "+3.2% desde ayer",
    trendVariant: "success" as const,
  },
  {
    title: "Puertas Monitoreadas",
    value: "24",
    trend: "0% desde ayer",
    trendVariant: "muted" as const,
  },
  {
    title: "Accesos Denegados",
    value: "12",
    trend: "-8.3% desde ayer",
    trendVariant: "destructive" as const,
  },
]

const chartData = [
  { name: "Lun", accesos: 220 },
  { name: "Mar", accesos: 260 },
  { name: "Mié", accesos: 250 },
  { name: "Jue", accesos: 310 },
  { name: "Vie", accesos: 270 },
  { name: "Sáb", accesos: 140 },
  { name: "Dom", accesos: 110 },
]

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
  const { events, connected, error } = useRfidStream({ bufferSize: 25 })

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
        {stats.map((item) => (
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
            <ChartContainer config={chartConfig} className="h-64">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={32} />
                <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="accesos" radius={[8, 8, 4, 4]} fill="var(--primary)" />
              </BarChart>
            </ChartContainer>
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
