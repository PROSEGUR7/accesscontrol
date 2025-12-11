"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Movement } from "@/types/movement"
import {
  Activity,
  Antenna,
  BadgeAlert,
  BadgeCheck,
  BadgeMinus,
  CalendarClock,
  ChevronRight,
  DoorClosed,
  EllipsisVertical,
  Eye,
  Pencil,
  RadioTower,
  Tag,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react"

type MovementsTableProps = {
  data: Movement[]
  loading?: boolean
  onView?: (movement: Movement) => void
  onEdit?: (movement: Movement) => void
  onDelete?: (movement: Movement) => Promise<void> | void
  formatDate: (value: string | Date | null) => string
}

function ActionsMenu({ movement, onView, onEdit, onDelete }: { movement: Movement; onView?: MovementsTableProps["onView"]; onEdit?: MovementsTableProps["onEdit"]; onDelete?: MovementsTableProps["onDelete"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground data-[state=open]:bg-muted">
          <EllipsisVertical className="size-4" />
          <span className="sr-only">Abrir acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => onView?.(movement)}>
          <Eye className="mr-2 size-4" /> Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit?.(movement)}>
          <Pencil className="mr-2 size-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await onDelete?.(movement)
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 size-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MovementStatusBadge({ movement }: { movement: Movement }) {
  const { autorizado, gpoResultado } = movement

  if (autorizado === true) {
    return (
      <Badge variant="outline" className="border-emerald-500 bg-emerald-500/10 text-emerald-600">
        <BadgeCheck className="mr-1 size-3" /> Autorizado
      </Badge>
    )
  }

  if (autorizado === false) {
    return (
      <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
        <BadgeAlert className="mr-1 size-3" /> Denegado
      </Badge>
    )
  }

  if (gpoResultado === "error") {
    return (
      <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-600">
        <Activity className="mr-1 size-3" /> Error GPO
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground">
      <BadgeMinus className="mr-1 size-3" /> Sin decisión
    </Badge>
  )
}

function EntityLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3" />
      <span className="font-medium text-foreground/80">{label}</span>
      <ChevronRight className="size-3" />
      <span>{value}</span>
    </div>
  )
}

export function MovementsTable({ data, loading, onView, onEdit, onDelete, formatDate }: MovementsTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <div className="text-muted-foreground text-sm">No hay movimientos registrados.</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead className="hidden md:table-cell">EPC</TableHead>
            <TableHead>Entidades</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden lg:table-cell">Motivo</TableHead>
            <TableHead className="w-[80px]"><span className="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {formatDate(movement.timestamp)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {movement.tipo ?? "Movimiento"}
                    {movement.direccion ? ` · ${movement.direccion}` : null}
                  </div>
                  {movement.readCount ? (
                    <span className="text-[11px] text-muted-foreground">
                      {movement.readCount} lecturas · Última: {movement.lastSeen ? formatDate(movement.lastSeen) : "—"}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-col gap-1 text-sm font-mono">
                  <div className="inline-flex items-center gap-1">
                    <Tag className="size-3 text-muted-foreground" />
                    {movement.epc ?? "—"}
                  </div>
                  <span className="text-[11px] text-muted-foreground">ID #{movement.id}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {movement.personaNombre ? (
                    <EntityLine icon={UserRound} label="Persona" value={`${movement.personaNombre}${movement.personaId ? ` (#${movement.personaId})` : ""}`} />
                  ) : null}
                  {movement.objetoNombre ? (
                    <EntityLine icon={RadioTower} label="Objeto" value={`${movement.objetoNombre}${movement.objetoId ? ` (#${movement.objetoId})` : ""}`} />
                  ) : null}
                  {movement.puertaNombre ? (
                    <EntityLine icon={DoorClosed} label="Puerta" value={`${movement.puertaNombre}${movement.puertaId ? ` (#${movement.puertaId})` : ""}`} />
                  ) : null}
                  {movement.lectorId ? (
                    <EntityLine icon={Activity} label="Lector" value={`#${movement.lectorId}${movement.lectorNombre ? ` · ${movement.lectorNombre}` : ""}`} />
                  ) : null}
                  {movement.antenaId ? (
                    <EntityLine icon={Antenna} label="Antena" value={`#${movement.antenaId}${movement.antenaIndice != null ? ` · Índice ${movement.antenaIndice}` : ""}`} />
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <MovementStatusBadge movement={movement} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {movement.motivo ?? movement.decisionMotivo ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <ActionsMenu movement={movement} onView={onView} onEdit={onEdit} onDelete={onDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
