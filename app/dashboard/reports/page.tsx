import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


const reports = [
  {
    id: "RPT-2025-001",
    period: "Últimas 24 horas",
    incidents: 12,
    critical: 1,
    generated: "18/10/2025 08:30",
    status: "Listo",
  },
  {
    id: "RPT-2025-002",
    period: "Turno nocturno",
    incidents: 4,
    critical: 0,
    generated: "18/10/2025 06:15",
    status: "Listo",
  },
  {
    id: "RPT-2025-003",
    period: "Accesos denegados",
    incidents: 7,
    critical: 2,
    generated: "17/10/2025 22:10",
    status: "Revisar",
  },
  {
    id: "RPT-2025-004",
    period: "Mantenimiento",
    incidents: 3,
    critical: 0,
    generated: "17/10/2025 18:45",
    status: "Listo",
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Reportes y auditoría</CardTitle>
          <CardDescription>Genera informes para auditorías y revisiones de seguridad</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-full px-4 py-2 text-sm">
            Últimas 24 h
          </Button>
          <Button variant="outline" className="rounded-full px-4 py-2 text-sm">
            Turno nocturno
          </Button>
          <Button variant="outline" className="rounded-full px-4 py-2 text-sm">
            Accesos críticos
          </Button>
          <Button variant="outline" className="rounded-full px-4 py-2 text-sm">
            Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Historial de reportes</CardTitle>
          <CardDescription>Listado de informes generados recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Incidentes</TableHead>
                <TableHead>Críticos</TableHead>
                <TableHead>Generado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium text-foreground">{report.id}</TableCell>
                  <TableCell>{report.period}</TableCell>
                  <TableCell>{report.incidents}</TableCell>
                  <TableCell>{report.critical}</TableCell>
                  <TableCell>{report.generated}</TableCell>
                  <TableCell>
                    <Badge
                      variant={report.status === "Revisar" ? "destructive" : "outline"}
                      className={
                        report.status === "Revisar"
                          ? "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                      }
                    >
                      {report.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-end">
          <Button variant="default">Generar nuevo reporte</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
