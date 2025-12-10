import { FileSpreadsheet, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSessionFromCookies } from "@/lib/auth"
import { getReportsDataForTenant } from "@/lib/reports"

export const revalidate = 0

async function getReportsData() {
  const session = await getSessionFromCookies()

  if (!session?.tenant) {
    throw new Error("No se pudo determinar el tenant para los reportes")
  }

  const tenant = session.tenant

  return getReportsDataForTenant(tenant)
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}

function statusBadge(value: boolean | null) {
  if (value === true) {
    return <Badge className="border-emerald-500 bg-emerald-500/10 text-emerald-600">Autorizado</Badge>
  }
  if (value === false) {
    return <Badge className="border-destructive/60 bg-destructive/10 text-destructive">Denegado</Badge>
  }
  return <Badge variant="outline">Sin decisión</Badge>
}

import { useState } from "react"

export default function ReportsPageWrapper() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function fetchReports() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const res = await fetch(`/api/dashboard/reports/export?format=json&${params.toString()}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos iniciales
  useEffect(() => { fetchReports() }, [])

  const daily = data?.daily || []
  const recent = data?.recent || []
  const personas = data?.personas || []
  const objetos = data?.objetos || []
  const puertas = data?.puertas || []
  const lectores = data?.lectores || []
  const tipos = data?.tipos || []
  const decisionReasons = data?.decisionReasons || []
  const decisionCodes = data?.decisionCodes || []

  const totals = daily.reduce(
    (acc, item) => {
      acc.total += item.total
      acc.authorized += item.authorized
      acc.denied += item.denied
      acc.pending += item.pending
      return acc
    },
    { total: 0, authorized: 0, denied: 0, pending: 0 },
  )

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Reportes y auditoría</CardTitle>
            <CardDescription>Actividad real basada en movimientos filtrados.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            <span>a</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            <Button size="sm" onClick={fetchReports} disabled={loading}>{loading ? "Cargando..." : "Filtrar"}</Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/dashboard/reports/export?format=excel${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" /> Exportar Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/dashboard/reports/export?format=pdf${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Exportar PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Movimientos</p>
              <p className="text-2xl font-semibold text-foreground">{totals.total}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Autorizados</p>
              <p className="text-2xl font-semibold text-emerald-600">{totals.authorized}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Denegados</p>
              <p className="text-2xl font-semibold text-destructive">{totals.denied}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-semibold text-amber-600">{totals.pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Actividad por día</CardTitle>
          <CardDescription>Últimos 30 días de movimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Movimientos</TableHead>
                  <TableHead>Autorizados</TableHead>
                  <TableHead>Denegados</TableHead>
                  <TableHead>Pendientes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin registros en los últimos 30 días.
                    </TableCell>
                  </TableRow>
                ) : (
                  daily.map((row) => (
                    <TableRow key={row.day}>
                      <TableCell className="font-medium text-foreground">{formatDate(`${row.day}T00:00:00Z`)}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                      <TableCell className="text-destructive">{row.denied}</TableCell>
                      <TableCell className="text-amber-600">{row.pending}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Movimientos detallados</CardTitle>
          <CardDescription>Últimos eventos con todo el contexto disponible.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[1600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>EPC</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Puerta</TableHead>
                  <TableHead>Lectora</TableHead>
                  <TableHead>Antena</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>RSSI</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Razón</TableHead>
                  <TableHead>Códigos</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center text-muted-foreground">
                      Sin movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium whitespace-nowrap">#{row.id}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(row.ts)}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{row.epc ?? "—"}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px] space-y-1">
                          <p>{row.persona ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {row.personaId ?? "—"} · EPC: {row.personaEpc ?? "—"} · Habilitada: {formatBoolean(row.personaHabilitada)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] space-y-1">
                          <p>{row.objeto ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {row.objetoId ?? "—"} · Tipo: {row.objetoTipo ?? "—"} · Estado: {row.objetoEstado ?? "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] space-y-1">
                          <p>{row.puerta ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {row.puertaId ?? "—"} · Activa: {formatBoolean(row.puertaActiva)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] space-y-1">
                          <p>{row.lector ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {row.lectorId ?? "—"} · IP: {row.lectorIp ?? "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] whitespace-nowrap text-sm text-muted-foreground">
                        {row.antena ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.tipo ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.direccion ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatRssi(row.rssi)}</TableCell>
                      <TableCell className="max-w-[220px] whitespace-nowrap text-sm text-muted-foreground">
                        <span className="line-clamp-1">{row.motivo ?? "—"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{statusBadge(row.authorized)}</TableCell>
                      <TableCell className="max-w-[220px] whitespace-nowrap text-sm text-muted-foreground">
                        <span className="line-clamp-2">{row.decisionReason ?? "—"}</span>
                      </TableCell>
                      <TableCell>{renderCodes(row.decisionCodes)}</TableCell>
                      <TableCell>{renderNotes(row.decisionNotes)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Personas con más actividad</CardTitle>
            <CardDescription>Top {personas.length} personas por movimientos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Movimientos</TableHead>
                    <TableHead>Autorizados</TableHead>
                    <TableHead>Denegados</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Último</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sin datos disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    personas.map((row) => (
                      <TableRow key={`${row.personaId ?? "sin"}-${row.persona ?? "persona"}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.persona ?? "Sin persona"}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {row.personaId ?? "—"} · EPC: {row.personaEpc ?? "—"} · Habilitada: {formatBoolean(row.personaHabilitada)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                        <TableCell className="text-destructive">{row.denied}</TableCell>
                        <TableCell className="text-amber-600">{row.pending}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.lastSeen ? formatDateTime(row.lastSeen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Objetos controlados</CardTitle>
            <CardDescription>Objetos asociados y su comportamiento reciente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Objeto</TableHead>
                    <TableHead>Movimientos</TableHead>
                    <TableHead>Autorizados</TableHead>
                    <TableHead>Denegados</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Último</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objetos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sin datos disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    objetos.map((row) => (
                      <TableRow key={`${row.objetoId ?? "obj"}-${row.objeto ?? "sin"}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.objeto ?? "Sin objeto"}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {row.objetoId ?? "—"} · Tipo: {row.objetoTipo ?? "—"} · Estado: {row.objetoEstado ?? "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                        <TableCell className="text-destructive">{row.denied}</TableCell>
                        <TableCell className="text-amber-600">{row.pending}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.lastSeen ? formatDateTime(row.lastSeen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Puertas más activas</CardTitle>
            <CardDescription>Resumen por punto de acceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Puerta</TableHead>
                    <TableHead>Movimientos</TableHead>
                    <TableHead>Autorizados</TableHead>
                    <TableHead>Denegados</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Último</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puertas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sin datos disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    puertas.map((row) => (
                      <TableRow key={`${row.puertaId ?? "door"}-${row.puerta ?? "sin"}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.puerta ?? "Sin puerta"}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {row.puertaId ?? "—"} · Activa: {formatBoolean(row.puertaActiva)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                        <TableCell className="text-destructive">{row.denied}</TableCell>
                        <TableCell className="text-amber-600">{row.pending}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.lastSeen ? formatDateTime(row.lastSeen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Lectoras y sensores</CardTitle>
            <CardDescription>Sensores que participaron en los eventos recientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lectora</TableHead>
                    <TableHead>Movimientos</TableHead>
                    <TableHead>Autorizados</TableHead>
                    <TableHead>Denegados</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Último</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lectores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sin datos disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lectores.map((row) => (
                      <TableRow key={`${row.lectorId ?? "reader"}-${row.lector ?? "sin"}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.lector ?? "Sin lector"}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {row.lectorId ?? "—"} · IP: {row.lectorIp ?? "—"} · Activo: {formatBoolean(row.lectorActivo)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                        <TableCell className="text-destructive">{row.denied}</TableCell>
                        <TableCell className="text-amber-600">{row.pending}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.lastSeen ? formatDateTime(row.lastSeen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Tipos de movimiento</CardTitle>
            <CardDescription>Clasificación por tipo declarado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Movimientos</TableHead>
                    <TableHead>Autorizados</TableHead>
                    <TableHead>Denegados</TableHead>
                    <TableHead>Pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Sin datos disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tipos.map((row) => (
                      <TableRow key={row.tipo}>
                        <TableCell className="font-medium">{row.tipo}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-emerald-600">{row.authorized}</TableCell>
                        <TableCell className="text-destructive">{row.denied}</TableCell>
                        <TableCell className="text-amber-600">{row.pending}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Motivos y códigos de decisión</CardTitle>
            <CardDescription>Principales razones y códigos reportados por el motor de control de acceso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Razones frecuentes</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <Table className="min-w-[400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razón</TableHead>
                      <TableHead>Eventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisionReasons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      decisionReasons.map((row) => (
                        <TableRow key={row.label ?? "sin-razon"}>
                          <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                            <span className="line-clamp-2">{row.label}</span>
                          </TableCell>
                          <TableCell>{row.total}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-foreground">Códigos detectados</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <Table className="min-w-[320px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Eventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisionCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      decisionCodes.map((row) => (
                        <TableRow key={row.code}>
                          <TableCell className="font-mono text-xs">{row.code}</TableCell>
                          <TableCell>{row.total}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Sí"
  if (value === false) return "No"
  return "—"
}

function renderCodes(codes: string[] | null | undefined) {
  if (!codes || codes.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {codes.map((code) => (
        <Badge key={code} variant="outline" className="text-xs">
          {code}
        </Badge>
      ))}
    </div>
  )
}

function renderNotes(notes: string[] | null | undefined) {
  if (!notes || notes.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <ul className="max-w-[280px] list-disc space-y-1 pl-4 text-xs text-muted-foreground">
      {notes.map((note, index) => (
        <li key={`${note}-${index}`}>{note}</li>
      ))}
    </ul>
  )
}

function formatRssi(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—"
  }
  return `${value.toFixed(1)} dBm`
}
