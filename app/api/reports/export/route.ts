import { NextResponse } from "next/server"
import PDFDocument from "pdfkit"
import { z } from "zod"

import { query } from "@/lib/db"

export const runtime = "nodejs"

const paramsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(["movimientos", "denegados", "todos"]).optional(),
  format: z.enum(["csv", "pdf"]).optional(),
})

function parseDate(value: string | undefined) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

type MovementReportRow = {
  id: number
  ts: string
  tipo: string | null
  epc: string | null
  direccion: string | null
  motivo: string | null
  created_at: string
  persona_nombre: string | null
  objeto_nombre: string | null
  puerta_nombre: string | null
}

function toCsvValue(input: unknown) {
  if (input === null || input === undefined) return ""
  const value = String(input)
  if (/"|,|\n|\r/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsedParams = paramsSchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      type: (url.searchParams.get("type") as "movimientos" | "denegados" | "todos" | null) ?? undefined,
      format: (url.searchParams.get("format") as "csv" | "pdf" | null) ?? undefined,
    })

    if (!parsedParams.success) {
      return NextResponse.json({ message: "Parámetros inválidos" }, { status: 400 })
    }

    const now = new Date()
    const from = parseDate(parsedParams.data.from) ?? new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const to = parseDate(parsedParams.data.to) ?? now

    if (from > to) {
      return NextResponse.json({ message: "La fecha inicial no puede ser posterior a la final." }, { status: 400 })
    }

    const reportType = parsedParams.data.type ?? "movimientos"
    const formatType = parsedParams.data.format ?? "csv"

    const filters: string[] = ["m.ts >= $1", "m.ts <= $2"]
    if (reportType === "denegados") {
      filters.push(`(
        lower(coalesce(m.tipo, '')) LIKE '%deneg%'
        OR lower(coalesce(m.motivo, '')) LIKE '%deneg%'
      )`)
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : ""

    const rows = await query<MovementReportRow>(
      `SELECT
         m.id,
         m.ts,
         m.tipo,
         m.epc,
         m.direccion,
         m.motivo,
         m.created_at,
         per.nombre AS persona_nombre,
         obj.nombre AS objeto_nombre,
         pu.nombre AS puerta_nombre
       FROM tenant_base.movimientos m
       LEFT JOIN tenant_base.personas per ON per.id = m.persona_id
       LEFT JOIN tenant_base.objetos obj ON obj.id = m.objeto_id
       LEFT JOIN tenant_base.puertas pu ON pu.id = m.puerta_id
       ${whereClause}
       ORDER BY m.ts DESC
       LIMIT 10000`,
      [from.toISOString(), to.toISOString()],
    )

    const filenameBase = `reporte-${reportType}-${new Date().toISOString().replace(/[:]/g, "-").split(".")[0]}`

    const header = [
      "id",
      "timestamp",
      "tipo",
      "epc",
      "direccion",
      "motivo",
      "persona",
      "objeto",
      "puerta",
      "registrado_en",
    ]

    const lines = rows.map((row) =>
      [
        row.id,
        row.ts,
        row.tipo ?? "",
        row.epc ?? "",
        row.direccion ?? "",
        row.motivo ?? "",
        row.persona_nombre ?? "",
        row.objeto_nombre ?? "",
        row.puerta_nombre ?? "",
        row.created_at,
      ].map(toCsvValue).join(","),
    )

    if (formatType === "pdf") {
      const doc = new PDFDocument({ size: "A4", margin: 40 })
      const chunks: Buffer[] = []

      doc.on("data", (chunk: Buffer) => {
        chunks.push(chunk)
      })

      doc.on("error", (error: Error) => {
        console.error("PDF generation error", error)
      })

      doc.fontSize(16).text("Reporte de accesos", { align: "center" })
      doc.moveDown(0.5)
      doc.fontSize(10).text(`Tipo: ${reportType === "denegados" ? "Accesos denegados" : "Movimientos"}`)
      doc.text(`Rango: ${from.toLocaleString()} - ${to.toLocaleString()}`)
      doc.moveDown()

      const columnHeaders = ["ID", "Fecha", "Persona", "Puerta", "Tipo", "Motivo"]
      doc.font("Helvetica-Bold").text(columnHeaders.join(" | "))
      doc.moveDown(0.3)
      doc.font("Helvetica")

      rows.forEach((row) => {
        const line = [
          row.id,
          new Date(row.ts).toLocaleString(),
          row.persona_nombre ?? "",
          row.puerta_nombre ?? "",
          row.tipo ?? "",
          row.motivo ?? "",
        ].join(" | ")
        doc.text(line)
      })

      if (!rows.length) {
        doc.text("No se encontraron registros en el rango seleccionado.")
      }

      doc.end()

      await new Promise<void>((resolve, reject) => {
        doc.on("end", () => resolve())
        doc.on("error", (error: Error) => reject(error))
      })

      const buffer = Buffer.concat(chunks)
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const csv = `\ufeff${header.map(toCsvValue).join(",")}\r\n${lines.join("\r\n")}`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error generating report export", error)
    return NextResponse.json(
      { message: "No fue posible generar el reporte." },
      { status: 500 },
    )
  }
}
