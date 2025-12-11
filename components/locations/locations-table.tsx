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
import type { Location } from "@/types/location"
import { CalendarClock, EllipsisVertical, Eye, MapPin, Pencil, Trash2 } from "lucide-react"

type LocationsTableProps = {
  data: Location[]
  loading?: boolean
  onView?: (location: Location) => void
  onEdit?: (location: Location) => void
  onDelete?: (location: Location) => Promise<void> | void
  formatDate: (value: string) => string
}

function ActionsMenu({ location, onView, onEdit, onDelete }: { location: Location; onView?: (location: Location) => void; onEdit?: (location: Location) => void; onDelete?: (location: Location) => Promise<void> | void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="data-[state=open]:bg-muted/50 text-muted-foreground">
          <EllipsisVertical className="size-4" />
          <span className="sr-only">Abrir acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={() => onView?.(location)}>
          <Eye className="mr-2 size-4" /> Ver
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit?.(location)}>
          <Pencil className="mr-2 size-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await onDelete?.(location)
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 size-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LocationsTable({ data, loading, onView, onEdit, onDelete, formatDate }: LocationsTableProps) {
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
    return <div className="text-muted-foreground text-sm">No hay ubicaciones registradas.</div>
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ubicación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden lg:table-cell">Descripción</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead className="w-[80px]"><span className="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((location) => (
            <TableRow key={location.id}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{location.nombre}</span>
                  </div>
                  {location.tipo ? (
                    <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wide">
                      {location.tipo}
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground text-xs">ID #{location.id}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={location.activa ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-muted-foreground/30 bg-muted text-muted-foreground"}
                >
                  {location.activa ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {location.descripcion ? location.descripcion : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  {formatDate(location.createdAt)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <ActionsMenu location={location} onView={onView} onEdit={onEdit} onDelete={onDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
