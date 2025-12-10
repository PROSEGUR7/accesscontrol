import { NextResponse, type NextRequest } from "next/server"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"

import { getSessionFromRequest } from "@/lib/auth"
import { getReportsDataForTenant, type DailyReportRow, type RecentReportRow } from "@/lib/reports"

export const runtime = "nodejs"

type ExportFormat = "excel" | "pdf"

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    const tenant = session?.tenant

    if (!tenant) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const format = (request.nextUrl.searchParams.get("format") ?? "excel").toLowerCase() as ExportFormat

    if (!isValidFormat(format)) {
      return NextResponse.json({ message: "Formato no soportado" }, { status: 400 })
    }

    const { daily, recent } = await getReportsDataForTenant(tenant)

    if (format === "excel") {
      const buffer = await buildExcelWorkbook(daily, recent)
      return fileResponse(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
    }

    const buffer = await buildPdfDocument(daily, recent)
    return fileResponse(buffer, "application/pdf", "pdf")
  } catch (error) {
    console.error("dashboard reports export error", error)
    return NextResponse.json({ message: "No se pudo generar la exportación" }, { status: 500 })
  }
}

function isValidFormat(value: string): value is ExportFormat {
  return value === "excel" || value === "pdf"
}

async function buildExcelWorkbook(daily: DailyReportRow[], recent: RecentReportRow[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "AccessControl"
  workbook.created = new Date()

  const summarySheet = workbook.addWorksheet("Actividad diaria")
  summarySheet.columns = [
    { header: "Día", key: "day", width: 14 },
    { header: "Movimientos", key: "total", width: 16 },
    { header: "Autorizados", key: "authorized", width: 16 },
    { header: "Denegados", key: "denied", width: 16 },
    { header: "Pendientes", key: "pending", width: 16 },
  ]

  summarySheet.getRow(1).font = { bold: true }
  summarySheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" }
  summarySheet.views = [{ state: "frozen", ySplit: 1 }]
  summarySheet.getColumn("day").numFmt = "yyyy-mm-dd"

  const dailyRows = daily.map((row) => ({
    day: toDateFromDay(row.day),
    total: row.total,
    authorized: row.authorized,
    denied: row.denied,
    pending: row.pending,
  }))
  summarySheet.addRows(dailyRows)

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

  const totalsRow = summarySheet.addRow({
    day: "Totales",
    total: totals.total,
    authorized: totals.authorized,
    denied: totals.denied,
    pending: totals.pending,
  })
  totalsRow.font = { bold: true }
  totalsRow.alignment = { horizontal: "center" }

  summarySheet.autoFilter = {
    from: "A1",
    to: `E${summarySheet.rowCount}`,
  }

  const recentSheet = workbook.addWorksheet("Movimientos recientes")
  recentSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Fecha", key: "timestamp", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "EPC", key: "epc", width: 26 },
    { header: "Persona", key: "persona", width: 26 },
    { header: "Objeto", key: "objeto", width: 26 },
    { header: "Puerta", key: "puerta", width: 22 },
    { header: "Tipo", key: "tipo", width: 20 },
    { header: "Motivo", key: "motivo", width: 36 },
    { header: "Estado", key: "estado", width: 18 },
  ]

  recentSheet.getRow(1).font = { bold: true }
  recentSheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" }
  recentSheet.views = [{ state: "frozen", ySplit: 1 }]
  recentSheet.getColumn("motivo").alignment = { wrapText: true }
  recentSheet.getColumn("tipo").alignment = { wrapText: true }
  recentSheet.getColumn("persona").alignment = { wrapText: true }
  recentSheet.getColumn("objeto").alignment = { wrapText: true }
  recentSheet.getColumn("puerta").alignment = { wrapText: true }

  const recentRows = recent.map((row) => ({
    id: row.id,
    timestamp: toExcelDate(row.ts),
    epc: row.epc ?? "—",
    persona: row.persona ?? "—",
    objeto: row.objeto ?? "—",
    puerta: row.puerta ?? "—",
    tipo: row.tipo ?? "Movimiento",
    motivo: row.motivo ?? "—",
    estado: statusLabel(row.authorized),
  }))
  recentSheet.addRows(recentRows)

  if (recentSheet.rowCount > 1) {
    recentSheet.autoFilter = {
      from: "A1",
      to: `I${recentSheet.rowCount}`,
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

async function buildPdfDocument(daily: DailyReportRow[], recent: RecentReportRow[]) {
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

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", (error) => reject(error))

    doc.fontSize(18).text("Reporte de movimientos", { align: "center" })
    doc.moveDown(0.5)
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(`Generado: ${formatDateTime(new Date())}`, { align: "center" })
      .fillColor("#000000")

    doc.moveDown(1)
    doc.fontSize(12).text("Resumen de actividad (últimos 30 días)", { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11)
    doc.text(`Movimientos totales: ${totals.total}`)
    doc.text(`Autorizados: ${totals.authorized}`)
    doc.text(`Denegados: ${totals.denied}`)
    doc.text(`Pendientes: ${totals.pending}`)

    doc.moveDown(1)
    doc.fontSize(12).text("Actividad por día", { underline: true })
    doc.moveDown(0.5)
    daily.forEach((row) => {
      doc
        .fontSize(10)
        .text(
          `${formatDate(row.day)} | Total: ${row.total} | Autorizados: ${row.authorized} | Denegados: ${row.denied} | Pendientes: ${row.pending}`,
        )
    })

    doc.addPage()
    doc.fontSize(12).text("Movimientos recientes", { underline: true })
    doc.moveDown(0.5)
    recent.forEach((row) => {
      doc.fontSize(10).text(`ID: ${row.id}`, { continued: true }).text(`  Fecha: ${formatDateTime(row.ts)}`)
      doc.fontSize(10).text(`Persona: ${row.persona ?? "—"}  |  EPC: ${row.epc ?? "—"}`)
      doc.fontSize(10).text(`Objeto: ${row.objeto ?? "—"}  |  Puerta: ${row.puerta ?? "—"}`)
      doc
        .fontSize(10)
        .text(
          `Tipo: ${row.tipo ?? "Movimiento"}${row.motivo ? ` · ${row.motivo}` : ""}  |  Estado: ${statusLabel(row.authorized)}`,
        )
      doc.moveDown(0.5)
    })

    doc.end()
  })
}

function fileResponse(buffer: Buffer, contentType: string, extension: string) {
  const filename = `reportes-${formatFileTimestamp(new Date())}.${extension}`

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buffer.byteLength),
    },
  })
}

function formatFileTimestamp(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}${month}${day}-${hours}${minutes}`
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`)
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

function statusLabel(value: boolean | null) {
  if (value === true) return "Autorizado"
  if (value === false) return "Denegado"
  return "Sin decisión"
}

function toDateFromDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? day : date
}

function toExcelDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? value : date
}
