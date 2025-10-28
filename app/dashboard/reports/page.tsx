"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { endOfDay, format, startOfDay } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const reportTypeOptions = [
  { value: "movimientos" as const, label: "Todos los movimientos" },
  { value: "denegados" as const, label: "Accesos denegados" },
  { value: "todos" as const, label: "Histórico general" },
]

type ReportRow = {
  id: number
  timestamp: string
  tipo: string | null
  epc: string | null
  direccion: string | null
  motivo: string | null
  persona: string | null
  objeto: string | null
  puerta: string | null
  createdAt: string
}

type DownloadFormat = "csv" | "pdf" | null

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

export default function ReportsPage() {
  const [from, setFrom] = useState<Date>(() => startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState<Date>(() => endOfDay(new Date()))
  const [reportType, setReportType] = useState<(typeof reportTypeOptions)[number]["value"]>("movimientos")
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<DownloadFormat>(null)

  const hasInvalidRange = from > to

  const rangeSummary = useMemo(() => {
    if (!from || !to) return "Selecciona un rango para exportar"
    return `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`
  }, [from, to])

  const loadData = useCallback(async () => {
    if (!from || !to || hasInvalidRange) {
      setRows([])
      return
    }

    const params = new URLSearchParams({
      from: startOfDay(from).toISOString(),
      to: endOfDay(to).toISOString(),
      type: reportType,
      limit: "500",
    })

    setLoading(true)
    try {
      const response = await fetch(`/api/reports/list?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ message: "No fue posible obtener los datos." }))
        throw new Error((detail as { message?: string }).message ?? "No fue posible obtener los datos.")
      }

      const payload = (await response.json()) as { data?: ReportRow[] }
      setRows(payload.data ?? [])
    } catch (error) {
      console.error("Failed to load report data", error)
      setRows([])
      toast({
        variant: "destructive",
        title: "No se pudo cargar el reporte",
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos minutos.",
      })
    } finally {
      setLoading(false)
    }
  }, [from, to, reportType, hasInvalidRange])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleDateChange = useCallback((value: string, type: "from" | "to") => {
    if (!value) return
    const base = new Date(`${value}T00:00:00`)
    if (Number.isNaN(base.getTime())) {
      toast({
        variant: "destructive",
        title: "Fecha inválida",
        description: "Introduce una fecha válida para continuar.",
      })
      return
    }

    if (type === "from") {
      setFrom(startOfDay(base))
    } else {
      setTo(endOfDay(base))
    }
  }, [])

  const handleExport = useCallback(async (formatTarget: "csv" | "pdf") => {
    if (!from || !to || hasInvalidRange) {
      toast({
        variant: "destructive",
        title: "Rango inválido",
        description: "Asegúrate de que la fecha inicial sea anterior a la final.",
      })
      return
    }

    const params = new URLSearchParams({
      from: startOfDay(from).toISOString(),
      to: endOfDay(to).toISOString(),
      type: reportType,
      format: formatTarget,
    })

    setDownloading(formatTarget)
    try {
      const response = await fetch(`/api/reports/export?${params.toString()}`)
      if (!response.ok) {
        let detail = "No fue posible generar el reporte."
        try {
          const payload = (await response.json()) as { message?: string }
          if (payload?.message) detail = payload.message
        } catch (error) {
          console.error("Error parsing export response", error)
        }
        throw new Error(detail)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const timestamp = new Date().toISOString().replace(/[:]/g, "-").split(".")[0]
      link.href = url
      link.download = `reporte-${reportType}-${timestamp}.${formatTarget}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast({
        title: "Reporte generado",
        description: `El archivo ${formatTarget.toUpperCase()} se descargó correctamente.`,
      })
    } catch (error) {
      console.error("Error exporting report", error)
      toast({
        variant: "destructive",
        title: "No se pudo exportar",
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos minutos.",
      })
    } finally {
      setDownloading(null)
    }
  }, [from, to, hasInvalidRange, reportType])

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Reportes y auditoría</CardTitle>
          <CardDescription>Filtra por fechas y exporta en CSV o PDF con datos reales de la base.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Tipo de reporte</p>
              <Select value={reportType} onValueChange={(value) => setReportType(value as typeof reportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Desde</p>
                <Input
                  type="date"
                  value={format(from, "yyyy-MM-dd")}
                  max={format(to, "yyyy-MM-dd")}
                  onChange={(event) => handleDateChange(event.target.value, "from")}
                />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Hasta</p>
                <Input
                  type="date"
                  value={format(to, "yyyy-MM-dd")}
                  min={format(from, "yyyy-MM-dd")}
                  onChange={(event) => handleDateChange(event.target.value, "to")}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Resumen</p>
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  hasInvalidRange ? "border-destructive text-destructive" : "text-muted-foreground",
                )}
              >
                {rangeSummary}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
            <p>
              Los reportes se generan directamente desde <code>tenant_base.movimientos</code> y se relacionan con
              personas, objetos y puertas para darte un panorama completo de los accesos.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={loading || downloading !== null}
                onClick={() => void loadData()}
              >
                {loading ? "Actualizando..." : "Actualizar tabla"}
              </Button>
              <Button
                onClick={() => void handleExport("csv")}
                disabled={downloading !== null || hasInvalidRange || loading}
              >
                {downloading === "csv" ? "Generando..." : "Exportar CSV"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleExport("pdf")}
                disabled={downloading !== null || hasInvalidRange || loading}
              >
                {downloading === "pdf" ? "Generando..." : "Exportar PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Detalle de movimientos</CardTitle>
          <CardDescription>
            {loading ? "Consultando datos en la base..." : `Mostrando ${rows.length} registros reales del rango seleccionado.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Puerta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Dirección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {loading ? "Cargando registros..." : "No hay datos para el rango seleccionado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-foreground">{row.id}</TableCell>
                      <TableCell>{new Date(row.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{row.persona ?? "—"}</TableCell>
                      <TableCell>{row.puerta ?? "—"}</TableCell>
                      <TableCell>{row.tipo ?? "—"}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-break-spaces">{row.motivo ?? "—"}</TableCell>
                      <TableCell>{row.direccion ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>Datos obtenidos en tiempo real desde la base PostgreSQL configurada.</div>
          <div>
            Rango: {format(from, "dd/MM/yyyy")} - {format(to, "dd/MM/yyyy")}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
