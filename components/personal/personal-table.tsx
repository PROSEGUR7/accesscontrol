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
  type ColumnDef,
  type Cell,
  type Header,
  type HeaderGroup,
  type Row,
  type Table as TableInstance,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table"
import {
  Badge,
} from "@/components/ui/badge"
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
import { Spinner } from "@/components/ui/spinner"
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

import type { Person } from "@/types/person"

type PersonalTableProps = {
  data: Person[]
  loading?: boolean
  onReorder?: (next: Person[]) => void
  onView?: (person: Person) => void
  onEdit?: (person: Person) => void
  onDelete?: (person: Person) => Promise<void> | void
  formatValidity: (person: Person) => string
  formatDate: (value: string) => string
}

const commonButtonClasses = "size-8"

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

function ActionsMenu({ person, onView, onEdit, onDelete }: { person: Person; onView?: (person: Person) => void; onEdit?: (person: Person) => void; onDelete?: (person: Person) => Promise<void> | void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="data-[state=open]:bg-muted text-muted-foreground">
          <EllipsisVertical className="size-4" />
          <span className="sr-only">Abrir acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={() => onView?.(person)}>
          <Eye className="mr-2 size-4" /> Ver
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit?.(person)}>
          <Pencil className="mr-2 size-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await onDelete?.(person)
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 size-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DraggableRow({ row }: { row: Row<Person> }) {
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
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:shadow-lg data-[dragging=true]:bg-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell: Cell<Person, unknown>) => {
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

export function PersonalTable({
  data,
  loading,
  onReorder,
  onView,
  onEdit,
  onDelete,
  formatValidity,
  formatDate,
}: PersonalTableProps) {
  const [tableData, setTableData] = useState<Person[]>(data)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [pendingOrder, setPendingOrder] = useState<Person[] | null>(null)

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
    useSensor(KeyboardSensor)
  )

  const dataIds = useMemo<UniqueIdentifier[]>(() => tableData.map((item) => item.id.toString()), [tableData])
  const instanceId = useId()

  const columns = useMemo<ColumnDef<Person>[]>(() => [
    {
      id: "drag",
      header: () => null,
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "select",
      header: ({ table }: { table: TableInstance<Person> }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            aria-label="Seleccionar todo"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        </div>
      ),
      cell: ({ row }: { row: Row<Person> }) => (
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
          <ArrowDownAZ className="size-3" /> Nombre
        </div>
      ),
      cell: ({ row }: { row: Row<Person> }) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.original.nombre}</span>
          <span className="text-muted-foreground text-xs">ID #{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: "documento",
      header: "Documento",
  cell: ({ row }: { row: Row<Person> }) => row.original.documento ?? "—",
    },
    {
      accessorKey: "rfidEpc",
      header: "EPC",
      cell: ({ row }: { row: Row<Person> }) => (
        <span className="font-mono text-sm">{row.original.rfidEpc ?? "—"}</span>
      ),
    },
    {
      accessorKey: "habilitado",
      header: "Estado",
      cell: ({ row }: { row: Row<Person> }) => (
        <Badge
          variant={row.original.habilitado ? "outline" : "secondary"}
          className={row.original.habilitado ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-muted-foreground/30 bg-muted text-muted-foreground"}
        >
          {row.original.habilitado ? "Habilitado" : "Suspendido"}
        </Badge>
      ),
    },
    {
      id: "vigencia",
      header: "Vigencia",
  cell: ({ row }: { row: Row<Person> }) => formatValidity(row.original),
    },
    {
      accessorKey: "createdAt",
      header: "Creado",
      cell: ({ row }: { row: Row<Person> }) => (
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" />
          {formatDate(row.original.createdAt)}
        </div>
      ),
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }: { row: Row<Person> }) => (
        <ActionsMenu person={row.original} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ], [formatDate, formatValidity, onDelete, onEdit, onView])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
  getRowId: (row: Person) => row.id.toString(),
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
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!tableData.length) {
    return (
      <div className="text-muted-foreground text-sm">No hay personas registradas.</div>
    )
  }

  return (
    <div className="space-y-4">
  <div className="rounded-lg border overflow-hidden">
        <DndContext
          id={instanceId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-backdrop-blur:bg-muted/60">
              {table.getHeaderGroups().map((headerGroup: HeaderGroup<Person>) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<Person, unknown>) => (
                    <TableHead key={header.id} colSpan={header.colSpan} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                {table.getRowModel().rows.map((row: Row<Person>) => (
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
            <Label htmlFor="rows-per-page" className="text-sm font-medium text-foreground">
              Filas por página
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger id="rows-per-page" size="sm" className="w-20">
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
