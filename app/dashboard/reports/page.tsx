import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { query } from "@/lib/db"

export const revalidate = 0

type DailyRow = {
  day: string
  total: number
  authorized: number
  denied: number
  pending: number
}

type RecentRow = {
  id: number
  ts: Date
  epc: string | null
  persona: string | null
  objeto: string | null
  puerta: string | null
  tipo: string | null
  motivo: string | null
  authorized: boolean | null
}

async function getReportsData() {
  const [daily, recent] = await Promise.all([
    query<DailyRow>(
      `WITH daily AS (
         SELECT date_trunc('day', m.ts)::date AS day,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = true)::int AS authorized,
                COUNT(*) FILTER (
                  WHERE (m.extra->'accessControl'->'decision'->>'authorized')::boolean = false
                     OR lower(coalesce(m.tipo, '')) LIKE '%deneg%'
                )::int AS denied
           FROM movimientos m
          WHERE m.ts >= now() - interval '30 days'
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 30
       )
       SELECT to_char(day, 'YYYY-MM-DD') AS day,
              total,
              authorized,
              denied,
              GREATEST(total - authorized - denied, 0)::int AS pending
         FROM daily
        ORDER BY day DESC`
    ),
    query<RecentRow>(
      `SELECT m.id,
              m.ts,
              m.epc,
              per.nombre AS persona,
              obj.nombre AS objeto,
              door.nombre AS puerta,
              m.tipo,
              m.motivo,
              (m.extra->'accessControl'->'decision'->>'authorized')::boolean AS authorized
         FROM movimientos m
         LEFT JOIN personas per ON per.id = m.persona_id
         LEFT JOIN objetos obj ON obj.id = m.objeto_id
         LEFT JOIN puertas door ON door.id = m.puerta_id
        ORDER BY m.ts DESC
        LIMIT 12`
    ),
  ])

  return { daily, recent }
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

export default async function ReportsPage() {
  const { daily, recent } = await getReportsData()

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
        <CardHeader>
          <CardTitle>Reportes y auditoría</CardTitle>
          <CardDescription>Actividad real basada en movimientos de los últimos 30 días.</CardDescription>
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
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>Últimos 12 eventos capturados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>EPC</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Puerta</TableHead>
                  <TableHead>Tipo / Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Sin movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">#{row.id}</TableCell>
                      <TableCell>{formatDateTime(row.ts)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.epc ?? "—"}</TableCell>
                      <TableCell>{row.persona ?? "—"}</TableCell>
                      <TableCell>{row.objeto ?? "—"}</TableCell>
                      <TableCell>{row.puerta ?? "—"}</TableCell>
                      <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                        {row.tipo ?? "Movimiento"}
                        {row.motivo ? ` · ${row.motivo}` : null}
                      </TableCell>
                      <TableCell>{statusBadge(row.authorized)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
