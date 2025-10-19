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

const personnel = [
  {
    name: "Juan Pérez",
    role: "Supervisor de Seguridad",
    shift: "Matutino",
    lastAccess: "08:45 · Puerta Principal",
    status: "En sitio",
  },
  {
    name: "María García",
    role: "Ingeniera de Laboratorio",
    shift: "Mixto",
    lastAccess: "08:10 · Laboratorio A",
    status: "En sitio",
  },
  {
    name: "Carlos López",
    role: "Administrador TI",
    shift: "Matutino",
    lastAccess: "07:55 · Sala de Servidores",
    status: "Fuera de turno",
  },
  {
    name: "Ana Martínez",
    role: "Coordinadora de Recursos",
    shift: "Vespertino",
    lastAccess: "07:48 · Oficina 201",
    status: "Pendiente ingreso",
  },
  {
    name: "Pedro Sánchez",
    role: "Jefe de Logística",
    shift: "Nocturno",
    lastAccess: "06:10 · Almacén",
    status: "En sitio",
  },
]

export default function PersonalPage() {
  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Personal autorizado</CardTitle>
          <CardDescription>Control de roles, turnos y actividad reciente</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnel.map((person) => (
                <TableRow key={person.name}>
                  <TableCell className="font-medium text-foreground">{person.name}</TableCell>
                  <TableCell>{person.role}</TableCell>
                  <TableCell>{person.shift}</TableCell>
                  <TableCell>{person.lastAccess}</TableCell>
                  <TableCell>
                    <Badge
                      variant={person.status === "Fuera de turno" ? "secondary" : "outline"}
                      className={
                        person.status === "En sitio"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : person.status === "Fuera de turno"
                            ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                            : "border-amber-500 bg-amber-500/10 text-amber-600"
                      }
                    >
                      {person.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
