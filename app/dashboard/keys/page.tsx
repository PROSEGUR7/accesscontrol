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

const keys = [
  {
    code: "RFID-001",
    holder: "Juan Pérez",
    area: "Puerta Principal",
    expires: "31/12/2025",
    status: "Activa",
  },
  {
    code: "RFID-014",
    holder: "María García",
    area: "Laboratorio A",
    expires: "15/11/2025",
    status: "Activa",
  },
  {
    code: "RFID-023",
    holder: "Carlos López",
    area: "Sala de Servidores",
    expires: "05/10/2025",
    status: "Suspendida",
  },
  {
    code: "RFID-032",
    holder: "Ana Martínez",
    area: "Oficina 201",
    expires: "20/09/2025",
    status: "Activa",
  },
  {
    code: "RFID-041",
    holder: "Pedro Sánchez",
    area: "Almacén",
    expires: "18/08/2025",
    status: "Revocada",
  },
]

export default function KeysPage() {
  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Inventario de llaves RFID</CardTitle>
          <CardDescription>Estado y vigencia de credenciales</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead>Área autorizada</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.code}>
                  <TableCell className="font-medium text-foreground">{key.code}</TableCell>
                  <TableCell>{key.holder}</TableCell>
                  <TableCell>{key.area}</TableCell>
                  <TableCell>{key.expires}</TableCell>
                  <TableCell>
                    <Badge
                      variant={key.status === "Revocada" ? "destructive" : "outline"}
                      className={
                        key.status === "Activa"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : key.status === "Revocada"
                            ? "border-red-500 bg-red-500/10 text-red-500"
                            : "border-amber-500 bg-amber-500/10 text-amber-600"
                      }
                    >
                      {key.status}
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
