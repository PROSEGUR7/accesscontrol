import { NextResponse, type NextRequest } from "next/server"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"

import { getSessionFromRequest } from "@/lib/auth"
import {
  getReportsDataForTenant,
  type DailyReportRow,
  type RecentReportRow,
  type PersonaActivityRow,
  type ObjectActivityRow,
  type DoorActivityRow,
  type ReaderActivityRow,
  type MovementTypeSummaryRow,
  type DecisionReasonRow,
  type DecisionCodeRow,
} from "@/lib/reports"

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

    // Filtros de fecha y tipo de reporte
    const from = request.nextUrl.searchParams.get("from")
    const to = request.nextUrl.searchParams.get("to")
    const type = request.nextUrl.searchParams.get("type") || "movimientos"

    const empty = [];
    const { daily = empty, recent = empty, personas = empty, objetos = empty, puertas = empty, lectores = empty, tipos = empty, decisionReasons = empty, decisionCodes = empty } =
      await getReportsDataForTenant(tenant, { from, to }) || {};

    // Filtrar solo la hoja/sección correspondiente, pero siempre con columnas
    if (format === "excel") {
      let buffer;
      switch (type) {
        case "movimientos":
        case "reportes y auditoría":
          buffer = await buildExcelWorkbook(daily, empty, empty, empty, empty, empty, empty, empty, empty);
          break;
        case "actividad":
          buffer = await buildExcelWorkbook(daily, empty, empty, empty, empty, empty, empty, empty, empty);
          break;
        case "detallados":
          buffer = await buildExcelWorkbook(empty, recent, empty, empty, empty, empty, empty, empty, empty);
          break;
        case "personas":
          buffer = await buildExcelWorkbook(empty, empty, personas, empty, empty, empty, empty, empty, empty);
          break;
        case "objetos":
          buffer = await buildExcelWorkbook(empty, empty, empty, objetos, empty, empty, empty, empty, empty);
          break;
        case "puertas":
          buffer = await buildExcelWorkbook(empty, empty, empty, empty, puertas, empty, empty, empty, empty);
          break;
        case "lectores":
          buffer = await buildExcelWorkbook(empty, empty, empty, empty, empty, lectores, empty, empty, empty);
          break;
        case "tipos":
          buffer = await buildExcelWorkbook(empty, empty, empty, empty, empty, empty, tipos, empty, empty);
          break;
        default:
          buffer = await buildExcelWorkbook(daily, recent, personas, objetos, puertas, lectores, tipos, decisionReasons, decisionCodes);
      }
      return fileResponse(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
    }

    let buffer;
    switch (type) {
      case "movimientos":
      case "reportes y auditoría":
        buffer = await buildPdfDocument(daily, empty, empty, empty, empty, empty, empty, empty, empty);
        break;
      case "actividad":
        buffer = await buildPdfDocument(daily, empty, empty, empty, empty, empty, empty, empty, empty);
        break;
      case "detallados":
        buffer = await buildPdfDocument(empty, recent, empty, empty, empty, empty, empty, empty, empty);
        break;
      case "personas":
        buffer = await buildPdfDocument(empty, empty, personas, empty, empty, empty, empty, empty, empty);
        break;
      case "objetos":
        buffer = await buildPdfDocument(empty, empty, empty, objetos, empty, empty, empty, empty, empty);
        break;
      case "puertas":
        buffer = await buildPdfDocument(empty, empty, empty, empty, puertas, empty, empty, empty, empty);
        break;
      case "lectores":
        buffer = await buildPdfDocument(empty, empty, empty, empty, empty, lectores, empty, empty, empty);
        break;
      case "tipos":
        buffer = await buildPdfDocument(empty, empty, empty, empty, empty, empty, tipos, empty, empty);
        break;
      default:
        buffer = await buildPdfDocument(daily, recent, personas, objetos, puertas, lectores, tipos, decisionReasons, decisionCodes);
    }
    return fileResponse(buffer, "application/pdf", "pdf")
  } catch (error) {
    console.error("dashboard reports export error", error)
    return NextResponse.json({ message: "No se pudo generar la exportación" }, { status: 500 })
  }
}

function isValidFormat(value: string): value is ExportFormat {
  return value === "excel" || value === "pdf"
}

async function buildExcelWorkbook(
  daily: DailyReportRow[],
  recent: RecentReportRow[],
  personas: PersonaActivityRow[],
  objetos: ObjectActivityRow[],
  puertas: DoorActivityRow[],
  lectores: ReaderActivityRow[],
  tipos: MovementTypeSummaryRow[],
  decisionReasons: DecisionReasonRow[],
  decisionCodes: DecisionCodeRow[],
) {
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

  const recentSheet = workbook.addWorksheet("Movimientos detallados")
  recentSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Fecha", key: "timestamp", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "EPC", key: "epc", width: 24 },
    { header: "Persona", key: "persona", width: 26 },
    { header: "Persona ID", key: "personaId", width: 12 },
    { header: "Persona EPC", key: "personaEpc", width: 18 },
    { header: "Persona habilitada", key: "personaHabilitada", width: 18 },
    { header: "Objeto", key: "objeto", width: 24 },
    { header: "Objeto ID", key: "objetoId", width: 12 },
    { header: "Objeto tipo", key: "objetoTipo", width: 18 },
    { header: "Objeto estado", key: "objetoEstado", width: 18 },
    { header: "Puerta", key: "puerta", width: 24 },
    { header: "Puerta ID", key: "puertaId", width: 12 },
    { header: "Puerta activa", key: "puertaActiva", width: 16 },
    { header: "Lectora", key: "lectora", width: 24 },
    { header: "Lectora ID", key: "lectoraId", width: 12 },
    { header: "Lectora IP", key: "lectoraIp", width: 18 },
    { header: "Antena", key: "antena", width: 20 },
    { header: "Tipo", key: "tipo", width: 18 },
    { header: "Dirección", key: "direccion", width: 14 },
    { header: "RSSI", key: "rssi", width: 12, style: { numFmt: '0.0" dBm"' } },
    { header: "Motivo", key: "motivo", width: 30 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Razón", key: "razon", width: 30 },
    { header: "Códigos", key: "codigos", width: 24 },
    { header: "Notas", key: "notas", width: 36 },
  ]

  styleHeaderRow(recentSheet)
  ;["persona", "objeto", "puerta", "lectora", "antena", "motivo", "razon", "codigos", "notas"].forEach((key) => {
    const column = recentSheet.getColumn(key)
    if (column) {
      column.alignment = { wrapText: true }
    }
  })

  const recentRows = recent.map((row) => ({
    id: row.id,
    timestamp: toExcelDate(row.ts),
    epc: row.epc ?? "—",
    persona: row.persona ?? "—",
    personaId: row.personaId ?? "—",
    personaEpc: row.personaEpc ?? "—",
    personaHabilitada: formatBoolean(row.personaHabilitada),
    objeto: row.objeto ?? "—",
    objetoId: row.objetoId ?? "—",
    objetoTipo: row.objetoTipo ?? "—",
    objetoEstado: row.objetoEstado ?? "—",
    puerta: row.puerta ?? "—",
    puertaId: row.puertaId ?? "—",
    puertaActiva: formatBoolean(row.puertaActiva),
    lectora: row.lector ?? "—",
    lectoraId: row.lectorId ?? "—",
    lectoraIp: row.lectorIp ?? "—",
    antena: row.antena ?? "—",
    tipo: row.tipo ?? "Movimiento",
    direccion: row.direccion ?? "—",
    rssi: row.rssi ?? null,
    motivo: row.motivo ?? "—",
    estado: statusLabel(row.authorized),
    razon: row.decisionReason ?? "—",
    codigos: formatCodes(row.decisionCodes),
    notas: formatNotes(row.decisionNotes),
  }))
  recentSheet.addRows(recentRows)

  if (recentSheet.rowCount > 1) {
    recentSheet.autoFilter = {
      from: "A1",
      to: `${columnLetter(recentSheet.columnCount)}${recentSheet.rowCount}`,
    }
  }

  const personasSheet = workbook.addWorksheet("Personas")
  personasSheet.columns = [
    { header: "Persona", key: "persona", width: 28 },
    { header: "ID", key: "personaId", width: 12 },
    { header: "EPC", key: "personaEpc", width: 20 },
    { header: "Habilitada", key: "personaHabilitada", width: 14 },
    { header: "Movimientos", key: "total", width: 14 },
    { header: "Autorizados", key: "authorized", width: 14 },
    { header: "Denegados", key: "denied", width: 14 },
    { header: "Pendientes", key: "pending", width: 14 },
    { header: "Último", key: "lastSeen", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]
  styleHeaderRow(personasSheet)
  personasSheet.getColumn("persona").alignment = { wrapText: true }
  const personaRows = personas.map((row) => ({
    persona: row.persona ?? "Sin persona",
    personaId: row.personaId ?? "—",
    personaEpc: row.personaEpc ?? "—",
    personaHabilitada: formatBoolean(row.personaHabilitada),
    total: row.total,
    authorized: row.authorized,
    denied: row.denied,
    pending: row.pending,
    lastSeen: toExcelDateTime(row.lastSeen),
  }))
  personasSheet.addRows(personaRows)
  enableAutoFilter(personasSheet)

  const objetosSheet = workbook.addWorksheet("Objetos")
  objetosSheet.columns = [
    { header: "Objeto", key: "objeto", width: 26 },
    { header: "ID", key: "objetoId", width: 12 },
    { header: "Tipo", key: "objetoTipo", width: 18 },
    { header: "Estado", key: "objetoEstado", width: 18 },
    { header: "Movimientos", key: "total", width: 14 },
    { header: "Autorizados", key: "authorized", width: 14 },
    { header: "Denegados", key: "denied", width: 14 },
    { header: "Pendientes", key: "pending", width: 14 },
    { header: "Último", key: "lastSeen", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]
  styleHeaderRow(objetosSheet)
  objetosSheet.getColumn("objeto").alignment = { wrapText: true }
  const objetoRows = objetos.map((row) => ({
    objeto: row.objeto ?? "Sin objeto",
    objetoId: row.objetoId ?? "—",
    objetoTipo: row.objetoTipo ?? "—",
    objetoEstado: row.objetoEstado ?? "—",
    total: row.total,
    authorized: row.authorized,
    denied: row.denied,
    pending: row.pending,
    lastSeen: toExcelDateTime(row.lastSeen),
  }))
  objetosSheet.addRows(objetoRows)
  enableAutoFilter(objetosSheet)

  const puertasSheet = workbook.addWorksheet("Puertas")
  puertasSheet.columns = [
    { header: "Puerta", key: "puerta", width: 26 },
    { header: "ID", key: "puertaId", width: 12 },
    { header: "Activa", key: "puertaActiva", width: 12 },
    { header: "Movimientos", key: "total", width: 14 },
    { header: "Autorizados", key: "authorized", width: 14 },
    { header: "Denegados", key: "denied", width: 14 },
    { header: "Pendientes", key: "pending", width: 14 },
    { header: "Último", key: "lastSeen", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]
  styleHeaderRow(puertasSheet)
  puertasSheet.getColumn("puerta").alignment = { wrapText: true }
  const puertaRows = puertas.map((row) => ({
    puerta: row.puerta ?? "Sin puerta",
    puertaId: row.puertaId ?? "—",
    puertaActiva: formatBoolean(row.puertaActiva),
    total: row.total,
    authorized: row.authorized,
    denied: row.denied,
    pending: row.pending,
    lastSeen: toExcelDateTime(row.lastSeen),
  }))
  puertasSheet.addRows(puertaRows)
  enableAutoFilter(puertasSheet)

  const lectoresSheet = workbook.addWorksheet("Lectores")
  lectoresSheet.columns = [
    { header: "Lectora", key: "lector", width: 28 },
    { header: "ID", key: "lectorId", width: 12 },
    { header: "IP", key: "lectorIp", width: 18 },
    { header: "Activa", key: "lectorActivo", width: 12 },
    { header: "Movimientos", key: "total", width: 14 },
    { header: "Autorizados", key: "authorized", width: 14 },
    { header: "Denegados", key: "denied", width: 14 },
    { header: "Pendientes", key: "pending", width: 14 },
    { header: "Último", key: "lastSeen", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]
  styleHeaderRow(lectoresSheet)
  lectoresSheet.getColumn("lector").alignment = { wrapText: true }
  const lectorRows = lectores.map((row) => ({
    lector: row.lector ?? "Sin lector",
    lectorId: row.lectorId ?? "—",
    lectorIp: row.lectorIp ?? "—",
    lectorActivo: formatBoolean(row.lectorActivo),
    total: row.total,
    authorized: row.authorized,
    denied: row.denied,
    pending: row.pending,
    lastSeen: toExcelDateTime(row.lastSeen),
  }))
  lectoresSheet.addRows(lectorRows)
  enableAutoFilter(lectoresSheet)

  const tiposSheet = workbook.addWorksheet("Tipos movimiento")
  tiposSheet.columns = [
    { header: "Tipo", key: "tipo", width: 28 },
    { header: "Movimientos", key: "total", width: 14 },
    { header: "Autorizados", key: "authorized", width: 14 },
    { header: "Denegados", key: "denied", width: 14 },
    { header: "Pendientes", key: "pending", width: 14 },
  ]
  styleHeaderRow(tiposSheet)
  tiposSheet.getColumn("tipo").alignment = { wrapText: true }
  tiposSheet.addRows(
    tipos.map((row) => ({
      tipo: row.tipo,
      total: row.total,
      authorized: row.authorized,
      denied: row.denied,
      pending: row.pending,
    })),
  )
  enableAutoFilter(tiposSheet)

  const reasonsSheet = workbook.addWorksheet("Decisiones razones")
  reasonsSheet.columns = [
    { header: "Razón", key: "label", width: 50 },
    { header: "Eventos", key: "total", width: 14 },
  ]
  styleHeaderRow(reasonsSheet)
  reasonsSheet.getColumn("label").alignment = { wrapText: true }
  reasonsSheet.addRows(decisionReasons.map((row) => ({ label: row.label ?? "Sin razón", total: row.total })))
  enableAutoFilter(reasonsSheet)

  const codesSheet = workbook.addWorksheet("Decisiones códigos")
  codesSheet.columns = [
    { header: "Código", key: "code", width: 28 },
    { header: "Eventos", key: "total", width: 14 },
  ]
  styleHeaderRow(codesSheet)
  codesSheet.getColumn("code").alignment = { wrapText: true }
  codesSheet.addRows(decisionCodes.map((row) => ({ code: row.code, total: row.total })))
  enableAutoFilter(codesSheet)

  return workbook.xlsx.writeBuffer()
}

async function buildPdfDocument(
  daily: DailyReportRow[],
  recent: RecentReportRow[],
  personas: PersonaActivityRow[],
  objetos: ObjectActivityRow[],
  puertas: DoorActivityRow[],
  lectores: ReaderActivityRow[],
  tipos: MovementTypeSummaryRow[],
  decisionReasons: DecisionReasonRow[],
  decisionCodes: DecisionCodeRow[],
) {
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

  return await new Promise<Uint8Array>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on("end", () => {
      const merged = Buffer.concat(chunks)
      resolve(new Uint8Array(merged))
    })
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
    if (recent.length === 0) {
      doc.fontSize(10).text("Sin movimientos registrados.")
    } else {
      recent.forEach((row) => {
        doc.fontSize(10).text(`ID: ${row.id}  |  Fecha: ${formatDateTime(row.ts)}`)
        doc
          .fontSize(10)
          .text(
            `Persona: ${row.persona ?? "—"}  |  ID: ${row.personaId ?? "—"}  |  EPC: ${row.personaEpc ?? "—"}  |  Habilitada: ${formatBoolean(row.personaHabilitada)}`,
          )
        doc
          .fontSize(10)
          .text(
            `Objeto: ${row.objeto ?? "—"}  |  ID: ${row.objetoId ?? "—"}  |  Tipo: ${row.objetoTipo ?? "—"}  |  Estado: ${row.objetoEstado ?? "—"}`,
          )
        doc
          .fontSize(10)
          .text(
            `Puerta: ${row.puerta ?? "—"}  |  ID: ${row.puertaId ?? "—"}  |  Activa: ${formatBoolean(row.puertaActiva)} |  Lectora: ${row.lector ?? "—"} (${row.lectorIp ?? "—"})`,
          )
        doc
          .fontSize(10)
          .text(`Antena: ${row.antena ?? "—"}  |  Dirección: ${row.direccion ?? "—"}  |  RSSI: ${formatRssi(row.rssi)}`)
        doc
          .fontSize(10)
          .text(`Tipo: ${row.tipo ?? "Movimiento"}  |  Motivo: ${row.motivo ?? "—"}  |  Estado: ${statusLabel(row.authorized)}`)
        doc.fontSize(10).text(`Razón: ${row.decisionReason ?? "—"}`)
        if (row.decisionCodes?.length) {
          doc.fontSize(10).text(`Códigos: ${row.decisionCodes.join(", ")}`)
        }
        if (row.decisionNotes?.length) {
          doc.fontSize(10).text(`Notas: ${row.decisionNotes.join(" | ")}`)
        }
        doc.moveDown(0.6)
      })
    }

    const printSection = <T>(
      title: string,
      rows: T[],
      render: (row: T) => void,
      emptyMessage = "Sin datos disponibles.",
    ) => {
      doc.fontSize(12).text(title, { underline: true })
      doc.moveDown(0.5)
      if (rows.length === 0) {
        doc.fontSize(10).text(emptyMessage)
      } else {
        rows.forEach((row) => {
          render(row)
          doc.moveDown(0.4)
        })
      }
      doc.moveDown(0.8)
    }

    printSection("Personas con más actividad", personas, (row) => {
      doc
        .fontSize(10)
        .text(
          `${row.persona ?? "Sin persona"} (ID ${row.personaId ?? "—"}, EPC ${row.personaEpc ?? "—"}, Habilitada: ${formatBoolean(row.personaHabilitada)}) | ` +
            `Mov: ${row.total} · Aut: ${row.authorized} · Den: ${row.denied} · Pen: ${row.pending} · Último: ${row.lastSeen ? formatDateTime(row.lastSeen) : "—"}`,
        )
    })

    printSection("Objetos controlados", objetos, (row) => {
      doc
        .fontSize(10)
        .text(
          `${row.objeto ?? "Sin objeto"} (ID ${row.objetoId ?? "—"}, Tipo ${row.objetoTipo ?? "—"}, Estado ${row.objetoEstado ?? "—"}) | ` +
            `Mov: ${row.total} · Aut: ${row.authorized} · Den: ${row.denied} · Pen: ${row.pending} · Último: ${row.lastSeen ? formatDateTime(row.lastSeen) : "—"}`,
        )
    })

    printSection("Puertas más activas", puertas, (row) => {
      doc
        .fontSize(10)
        .text(
          `${row.puerta ?? "Sin puerta"} (ID ${row.puertaId ?? "—"}, Activa: ${formatBoolean(row.puertaActiva)}) | ` +
            `Mov: ${row.total} · Aut: ${row.authorized} · Den: ${row.denied} · Pen: ${row.pending} · Último: ${row.lastSeen ? formatDateTime(row.lastSeen) : "—"}`,
        )
    })

    printSection("Lectoras y sensores", lectores, (row) => {
      doc
        .fontSize(10)
        .text(
          `${row.lector ?? "Sin lector"} (ID ${row.lectorId ?? "—"}, IP ${row.lectorIp ?? "—"}, Activo: ${formatBoolean(row.lectorActivo)}) | ` +
            `Mov: ${row.total} · Aut: ${row.authorized} · Den: ${row.denied} · Pen: ${row.pending} · Último: ${row.lastSeen ? formatDateTime(row.lastSeen) : "—"}`,
        )
    })

    printSection("Tipos de movimiento", tipos, (row) => {
      doc
        .fontSize(10)
        .text(`Tipo: ${row.tipo} | Mov: ${row.total} · Aut: ${row.authorized} · Den: ${row.denied} · Pen: ${row.pending}`)
    })

    printSection("Razones de decisión", decisionReasons, (row) => {
      doc.fontSize(10).text(`${row.label ?? "Sin razón"} · Eventos: ${row.total}`)
    })

    printSection("Códigos de decisión", decisionCodes, (row) => {
      doc.fontSize(10).text(`${row.code} · Eventos: ${row.total}`)
    })

    doc.end()
  })
}

type BinaryPayload = ArrayBuffer | Uint8Array

function fileResponse(payload: BinaryPayload, contentType: string, extension: string) {
  const filename = `reportes-${formatFileTimestamp(new Date())}.${extension}`

  let dataView: Uint8Array
  if (payload instanceof ArrayBuffer) {
    dataView = new Uint8Array(payload)
  } else {
    dataView = new Uint8Array(payload)
  }

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

function toExcelDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Sí"
  if (value === false) return "No"
  return "—"
}

function formatCodes(codes: string[] | null | undefined) {
  if (!codes || codes.length === 0) return "—"
  return codes.join(", ")
}

function formatNotes(notes: string[] | null | undefined) {
  if (!notes || notes.length === 0) return "—"
  return notes.map((note) => `- ${note}`).join("\n")
}

function formatRssi(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—"
  return `${value.toFixed(1)} dBm`
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { horizontal: "center", vertical: "middle" }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
}

function enableAutoFilter(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: "A1",
      to: `${columnLetter(sheet.columnCount)}${sheet.rowCount}`,
    }
  }
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
