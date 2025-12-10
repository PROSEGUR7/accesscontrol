import { NextResponse, type NextRequest } from "next/server"
import ExcelJS from "exceljs"

import { getSessionFromRequest } from "@/lib/auth"
import { query } from "@/lib/db"
import {
  MOVEMENT_COLUMNS,
  buildMovementFromClause,
  mapMovement,
  type MovementRow,
} from "@/app/api/movimientos/movement-utils"
import type { Movement } from "@/types/movement"

export const runtime = "nodejs"

const DEFAULT_PAGE_SIZE = 25
const MIN_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 1000
const STATUS_VALUES = new Set(["authorized", "denied", "pending"])

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    const tenant = session?.tenant

    if (!tenant) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")?.trim() ?? ""
    const statusParam = searchParams.get("status")?.toLowerCase() ?? "all"
    const status = STATUS_VALUES.has(statusParam) ? statusParam : "all"
    const fromDate = parseDateParam(searchParams.get("from"), "start")
    const toDate = parseDateParam(searchParams.get("to"), "end")
    const page = clampPage(Number(searchParams.get("page") ?? "1"))
    const pageSize = clampPageSize(Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const filters: string[] = []
    const params: unknown[] = []

    if (fromDate) {
      params.push(fromDate)
      filters.push(`m.ts >= $${params.length}`)
    }

    if (toDate) {
      params.push(toDate)
      filters.push(`m.ts <= $${params.length}`)
    }

    if (status === "authorized") {
      filters.push("COALESCE((m.extra->'accessControl'->'decision'->>'authorized')::boolean, false) = true")
    } else if (status === "denied") {
      filters.push("COALESCE((m.extra->'accessControl'->'decision'->>'authorized')::boolean, false) = false")
    } else if (status === "pending") {
      filters.push("(m.extra->'accessControl'->'decision'->>'authorized') IS NULL")
    }

    if (search) {
      const pattern = `%${search}%`
      params.push(pattern)
      const placeholder = `$${params.length}`
      filters.push(`(
        m.epc ILIKE ${placeholder}
        OR EXISTS (SELECT 1 FROM personas per WHERE per.id = m.persona_id AND per.nombre ILIKE ${placeholder})
        OR EXISTS (SELECT 1 FROM objetos obj WHERE obj.id = m.objeto_id AND obj.nombre ILIKE ${placeholder})
        OR EXISTS (SELECT 1 FROM puertas door WHERE door.id = m.puerta_id AND door.nombre ILIKE ${placeholder})
      )`)
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

    const dataParams = [...params, pageSize, offset]
    const rows = await query<MovementRow>(
      `SELECT ${MOVEMENT_COLUMNS}
       ${buildMovementFromClause()}
       ${whereClause}
       ORDER BY m.ts DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams,
      tenant,
    )

    const movements = rows.map(mapMovement)
    const buffer = await buildExcelWorkbook(movements)

    return fileResponse(
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "xlsx",
    )
  } catch (error) {
    console.error("dashboard movimientos export", error)
    return NextResponse.json({ message: "No se pudo generar la exportación" }, { status: 500 })
  }
}

async function buildExcelWorkbook(movements: Movement[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "AccessControl"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Movimientos")
  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Fecha", key: "timestamp", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "EPC", key: "epc", width: 24 },
    { header: "Tipo", key: "tipo", width: 18 },
    { header: "Dirección", key: "direccion", width: 14 },
    { header: "Persona", key: "persona", width: 24 },
    { header: "Persona ID", key: "personaId", width: 12 },
    { header: "Objeto", key: "objeto", width: 24 },
    { header: "Objeto ID", key: "objetoId", width: 12 },
    { header: "Puerta", key: "puerta", width: 24 },
    { header: "Puerta ID", key: "puertaId", width: 12 },
    { header: "Lectora", key: "lectora", width: 24 },
    { header: "Lectora ID", key: "lectoraId", width: 12 },
    { header: "Antena", key: "antena", width: 12 },
    { header: "RSSI", key: "rssi", width: 12, style: { numFmt: '0.0" dBm"' } },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Motivo movimiento", key: "motivo", width: 32 },
    { header: "Razón decisión", key: "decisionMotivo", width: 32 },
    { header: "Códigos decisión", key: "decisionCodigos", width: 24 },
    { header: "Notas decisión", key: "decisionNotas", width: 36 },
    { header: "Lecturas", key: "readCount", width: 12 },
    { header: "Última lectura", key: "lastSeen", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]

  styleHeaderRow(sheet)

  ;["persona", "objeto", "puerta", "lectora", "motivo", "decisionMotivo", "decisionCodigos", "decisionNotas"].forEach((key) => {
    const column = sheet.getColumn(key)
    if (column) {
      column.alignment = { wrapText: true }
    }
  })

  const rows = movements.map((movement) => ({
    id: movement.id,
    timestamp: toExcelDateTime(movement.timestamp),
    epc: movement.epc ?? "—",
    tipo: movement.tipo ?? "—",
    direccion: movement.direccion ?? "—",
    persona: movement.personaNombre ?? "—",
    personaId: movement.personaId ?? "—",
    objeto: movement.objetoNombre ?? "—",
    objetoId: movement.objetoId ?? "—",
    puerta: movement.puertaNombre ?? "—",
    puertaId: movement.puertaId ?? "—",
    lectora: movement.lectorNombre ?? "—",
    lectoraId: movement.lectorId ?? "—",
    antena: movement.antenaIndice == null ? "—" : `Antena ${movement.antenaIndice}`,
    rssi: movement.rssi ?? null,
    estado: statusLabel(movement.autorizado ?? null),
    motivo: movement.motivo ?? "—",
    decisionMotivo: movement.decisionMotivo ?? "—",
    decisionCodigos: formatCodes(movement.decisionCodigos),
    decisionNotas: formatNotes(movement.decisionNotas),
    readCount: movement.readCount ?? null,
    lastSeen: toExcelDateTime(movement.lastSeen),
  }))

  sheet.addRows(rows)

  if (sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: "A1",
      to: `${columnLetter(sheet.columnCount)}${sheet.rowCount}`,
    }
  }

  return workbook.xlsx.writeBuffer()
}

type BinaryPayload = ArrayBuffer | Uint8Array

function fileResponse(payload: BinaryPayload, contentType: string, extension: "xlsx") {
  const filename = `movimientos-${formatFileTimestamp(new Date())}.${extension}`

  const dataView = payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload)
  const arrayBuffer = new ArrayBuffer(dataView.byteLength)
  new Uint8Array(arrayBuffer).set(dataView)

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(dataView.byteLength),
    },
  })
}

function clampPageSize(raw: number | null | undefined) {
  if (!Number.isFinite(raw)) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(Math.trunc(raw as number), MIN_PAGE_SIZE), MAX_PAGE_SIZE)
}

function clampPage(raw: number | null | undefined) {
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.trunc(raw as number))
}

function parseDateParam(value: string | null, mode: "start" | "end") {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const result = new Date(date)
  if (mode === "start") {
    result.setHours(0, 0, 0, 0)
  } else {
    result.setHours(23, 59, 59, 999)
  }
  return result
}

function statusLabel(value: boolean | null) {
  if (value === true) return "Autorizado"
  if (value === false) return "Denegado"
  return "Sin decisión"
}

function toExcelDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCodes(codes: string[] | null | undefined) {
  if (!codes || codes.length === 0) return "—"
  return codes.join(", ")
}

function formatNotes(notes: string[] | null | undefined) {
  if (!notes || notes.length === 0) return "—"
  return notes.map((note) => `- ${note}`).join("\n")
}

function formatFileTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}${month}${day}-${hours}${minutes}`
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { horizontal: "center", vertical: "middle" }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
}

function columnLetter(index: number) {
  let dividend = index
  let column = ""
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26
    column = String.fromCharCode(65 + modulo) + column
    dividend = Math.floor((dividend - modulo) / 26)
  }
  return column || "A"
}
