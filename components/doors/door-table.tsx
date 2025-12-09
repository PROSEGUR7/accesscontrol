"use client"

import { useEffect, useId, useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Cell,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type SortingState,
  type Table as TableInstance,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowDownAZ,
  CalendarClock,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  EllipsisVertical,
  Eye,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react"

import type { Door } from "@/types/door"

type DoorTableProps = {
  data: Door[]
  loading?: boolean
  onReorder?: (next: Door[]) => void
    <div className="overflow-x-auto rounded-lg border">
  onEdit?: (door: Door) => void
  onDelete?: (door: Door) => Promise<void> | void
  formatDate: (value: string) => string
}

const statusStyles = {
  activa: "border-emerald-500 bg-emerald-500/10 text-emerald-600",
  inactiva: "border-muted-foreground/30 bg-muted text-muted-foreground",
  alerta: "border-amber-500 bg-amber-500/10 text-amber-600",
  bloqueo: "border-red-500 bg-red-500/10 text-red-500",
} as const

export function SkeletonDemo() {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  )
}

function DoorTableSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonDemo key={index} />
      ))}
    </div>
  )
}

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"]
  listeners: ReturnType<typeof useSortable>["listeners"]
  setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"]
}

function DragHandle({ attributes, listeners, setActivatorNodeRef }: DragHandleProps) {
  return (
    <Button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <GripVertical className="size-4" />
      <span className="sr-only">Arrastrar fila</span>
    </Button>
  )
}

function ActionsMenu({ door, onView, onEdit, onDelete }: { door: Door; onView?: DoorTableProps["onView"]; onEdit?: DoorTableProps["onEdit"]; onDelete?: DoorTableProps["onDelete"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground data-[state=open]:bg-muted">
          <EllipsisVertical className="size-4" />
          <span className="sr-only">Abrir acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => onView?.(door)}>
          <Eye className="mr-2 size-4" /> Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit?.(door)}>
          <Pencil className="mr-2 size-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await onDelete?.(door)
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 size-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function resolveStatus(door: Door) {
  const raw = door.estado?.toLowerCase().trim()
  if (raw?.includes("bloque")) {
    return {
      label: door.estado ?? "Bloqueada",
      className: statusStyles.bloqueo,
    }
  }
  if (raw?.includes("alert")) {
    return {
      label: door.estado ?? "Alerta",
      className: statusStyles.alerta,
    }
  }
  if (door.activa) {
    return {
      label: door.estado ?? "Activa",
      className: statusStyles.activa,
    }
  }
  return {
    label: door.estado ?? "Inactiva",
    className: statusStyles.inactiva,
  }
}

function DraggableRow({ row }: { row: Row<Door> }) {
  const {
    transform,
    transition,
    setNodeRef,
    isDragging,
    listeners,
    attributes,
    setActivatorNodeRef,
  } = useSortable({ id: row.id })

  return (
    <TableRow
      ref={setNodeRef}
      data-state={row.getIsSelected() ? "selected" : undefined}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:bg-card data-[dragging=true]:shadow-lg"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell: Cell<Door, unknown>) => {
        if (cell.column.id === "drag") {
          return (
            <TableCell key={cell.id} className="align-middle">
              <DragHandle attributes={attributes} listeners={listeners} setActivatorNodeRef={setActivatorNodeRef} />
            </TableCell>
          )
        }
        return (
          <TableCell key={cell.id} className="align-middle">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

const rowsPerPageOptions = [10, 20, 30, 50]
const commonButtonClasses = "size-8"

export function DoorTable({
  data,
  loading,
  onReorder,
  onView,
  onEdit,
  onDelete,
  formatDate,
}: DoorTableProps) {
  const [tableData, setTableData] = useState<Door[]>(data)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [pendingOrder, setPendingOrder] = useState<Door[] | null>(null)

  useEffect(() => {
    setTableData(data)
  }, [data])

  useEffect(() => {
    if (!pendingOrder) return
    onReorder?.(pendingOrder)
    setPendingOrder(null)
  }, [pendingOrder, onReorder])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const dataIds = useMemo<UniqueIdentifier[]>(() => tableData.map((item) => item.id.toString()), [tableData])
  const instanceId = useId()

  const columns = useMemo<ColumnDef<Door>[]>(() => [
    {
      id: "drag",
      header: () => null,
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "select",
      header: ({ table }: { table: TableInstance<Door> }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            aria-label="Seleccionar todo"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        </div>
      ),
      cell: ({ row }: { row: Row<Door> }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            aria-label="Seleccionar fila"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "nombre",
      header: () => (
        <div className="flex items-center gap-1 font-medium">
          <ArrowDownAZ className="size-3" /> Puerta
        </div>
      ),
      cell: ({ row }: { row: Row<Door> }) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {row.original.nombre}
          </span>
          {row.original.descripcion ? (
            <span className="text-muted-foreground text-xs">{row.original.descripcion}</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "ubicacion",
      header: "Ubicación",
      cell: ({ row }: { row: Row<Door> }) => row.original.ubicacion ?? "—",
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }: { row: Row<Door> }) => {
        const status = resolveStatus(row.original)
        return (
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "ultimoEvento",
      header: "Último evento",
      cell: ({ row }: { row: Row<Door> }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.ultimoEvento ?? "Sin eventos"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Creada",
      cell: ({ row }: { row: Row<Door> }) => (
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" />
          {formatDate(row.original.createdAt)}
        </div>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Actualizada",
      cell: ({ row }: { row: Row<Door> }) => (
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" />
          {formatDate(row.original.updatedAt)}
        </div>
      ),
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }: { row: Row<Door> }) => (
        <ActionsMenu door={row.original} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ], [formatDate, onDelete, onEdit, onView])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    getRowId: (row: Door) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: rowsPerPageOptions[0],
      },
    },
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setTableData((current) => {
        const activeId = String(active.id)
        const overId = String(over.id)
        const oldIndex = current.findIndex((item) => item.id.toString() === activeId)
        const newIndex = current.findIndex((item) => item.id.toString() === overId)
        if (oldIndex === -1 || newIndex === -1) {
          return current
        }
        const next = arrayMove(current, oldIndex, newIndex)
        setPendingOrder(next)
        return next
      })
    }
  }

  if (loading) {
    return <DoorTableSkeleton />
  }

  if (!tableData.length) {
    return (
      <div className="text-muted-foreground text-sm">No hay puertas registradas.</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <DndContext
          id={instanceId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-backdrop-blur:bg-muted/60">
              {table.getHeaderGroups().map((headerGroup: HeaderGroup<Door>) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<Door, unknown>) => (
                    <TableHead key={header.id} colSpan={header.colSpan} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                {table.getRowModel().rows.map((row: Row<Door>) => (
                  <DraggableRow key={row.id} row={row} />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <div className="flex flex-col gap-4 px-2 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <div>
          {table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
        </div>
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="door-rows-per-page" className="text-sm font-medium text-foreground">
              Filas por página
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger id="door-rows-per-page" size="sm" className="w-20">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {rowsPerPageOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-foreground text-sm font-medium">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`${commonButtonClasses} hidden lg:inline-flex`}
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="size-4" />
                <span className="sr-only">Primera página</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={commonButtonClasses}
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Página anterior</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={commonButtonClasses}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="size-4" />
                <span className="sr-only">Siguiente página</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`${commonButtonClasses} hidden lg:inline-flex`}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="size-4" />
                <span className="sr-only">Última página</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
