import { Badge } from "@/components/ui/badge"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const doors = [
  {
    name: "Puerta Principal",
    location: "Planta Baja",
    status: "Abierta",
    lastEvent: "08:45 · Acceso concedido",
    variant: "success" as const,
  },
  {
    name: "Laboratorio A",
    location: "Nivel 2",
    status: "Bloqueada",
    lastEvent: "08:10 · Acceso denegado",
    variant: "destructive" as const,
  },
  {
    name: "Sala de Servidores",
    location: "Nivel 3",
    status: "Cerrada",
    lastEvent: "07:55 · Mantenimiento programado",
    variant: "muted" as const,
  },
  {
    name: "Almacén",
    location: "Subsuelo",
    status: "Abierta",
    lastEvent: "07:48 · Acceso concedido",
    variant: "success" as const,
  },
  {
    name: "Recepción",
    location: "Planta Baja",
    status: "Cerrada",
    lastEvent: "07:30 · Cierre automático",
    variant: "muted" as const,
  },
]

export default function DoorsPage() {
  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Monitoreo de puertas</CardTitle>
          <CardDescription>Resumen de estados en tiempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Puerta</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doors.map((door) => (
                <TableRow key={door.name}>
                  <TableCell className="font-medium text-foreground">{door.name}</TableCell>
                  <TableCell>{door.location}</TableCell>
                  <TableCell>
                    <Badge
                      variant={door.variant === "destructive" ? "destructive" : "outline"}
                      className={
                        door.variant === "success"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : door.variant === "destructive"
                            ? "border-red-500 bg-red-500/10 text-red-500"
                            : "border-muted-foreground/40 bg-muted text-muted-foreground"
                      }
                    >
                      {door.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{door.lastEvent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
