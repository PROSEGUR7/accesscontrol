import { NextResponse, type NextRequest } from "next/server"
import { XMLParser } from "fast-xml-parser"
import { z } from "zod"

import { query } from "@/lib/db"
import { getSocketServer } from "@/lib/socket"

type MovementRow = {
  id: number
  ts: Date
  tipo: string | null
  epc: string | null
  persona_id: number | null
  objeto_id: number | null
  puerta_id: number | null
  lector_id: number | null
  antena_id: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
  created_at: Date
}

const payloadSchema = z.object({
  epc: z.string().min(1, "epc is required"),
  timestamp: z.union([z.string(), z.number()]).optional(),
  tipo: z.string().trim().optional(),
  personaId: z.union([z.string(), z.number()]).optional(),
  objetoId: z.union([z.string(), z.number()]).optional(),
  puertaId: z.union([z.string(), z.number()]).optional(),
  lectorId: z.union([z.string(), z.number()]).optional(),
  antenaId: z.union([z.string(), z.number()]).optional(),
  rssi: z.union([z.string(), z.number()]).optional(),
  direccion: z.string().trim().optional(),
  motivo: z.string().trim().optional(),
  extra: z.union([z.record(z.unknown()), z.array(z.unknown()), z.string()]).optional(),
})

const LOG_PREFIX = "[RFID-API]"
function logDebug(...args: unknown[]) {
  if (process.env.RFID_API_DEBUG === "false") return
  console.log(LOG_PREFIX, ...args)
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseAttributeValue: true,
})

type SimpleObject = Record<string, unknown>

const FIELD_ALIASES: Record<string, string[]> = {
  epc: ["epc", "tagid", "tagvalue", "id", "tagidhex", "tagiddec"],
  timestamp: ["timestamp", "ts", "time", "eventtime", "datetime", "created", "occuredat"],
  tipo: ["tipo", "type", "eventtype", "movementtype"],
  personaId: ["personaid", "persona_id", "personid", "person", "workerid"],
  objetoId: ["objetoid", "objectid", "assetid", "itemid"],
  puertaId: ["puertaid", "doorid", "gateid"],
  lectorId: ["lectorid", "readerid", "reader", "deviceid"],
  antenaId: ["antenaid", "antennaid", "antenna", "portid"],
  rssi: ["rssi", "signal", "signalstrength", "power"],
  direccion: ["direccion", "direction", "movement", "antennaevent"],
  motivo: ["motivo", "reason", "cause"],
  extra: ["extra", "metadata", "details", "payload"],
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function isPlainObject(value: unknown): value is SimpleObject {
  if (value === null || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function tryParseFormEncoded(raw: string) {
  const candidate = raw.replace(/\r?\n/g, "&")
  if (!/[^=&]+=/.test(candidate)) return null
  const params = new URLSearchParams(candidate)
  const result: Record<string, unknown> = {}
  for (const [key, value] of params.entries()) {
    if (key === "") continue
    if (result[key] === undefined) {
      result[key] = value
    } else if (Array.isArray(result[key])) {
      (result[key] as unknown[]).push(value)
    } else {
      result[key] = [result[key], value]
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

function tryParseXml(raw: string) {
  try {
    return xmlParser.parse(raw)
  } catch {
    return null
  }
}

function coercePayload(raw: string, contentType: string | null) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lowered = (contentType ?? "").toLowerCase()

  const attemptJson = () => tryParseJson(trimmed)
  const attemptForm = () => tryParseFormEncoded(trimmed)
  const attemptXml = () => tryParseXml(trimmed)

  if (lowered.includes("json")) {
    const json = attemptJson()
    if (json !== null) return json
  }

  if (lowered.includes("xml")) {
    const xml = attemptXml()
    if (xml !== null) return xml
  }

  if (lowered.includes("x-www-form-urlencoded")) {
    const form = attemptForm()
    if (form !== null) return form
  }

  if (lowered.includes("text/plain")) {
    const json = attemptJson()
    if (json !== null) return json
    const form = attemptForm()
    if (form !== null) return form
  }

  const json = attemptJson()
  if (json !== null) return json

  const xml = attemptXml()
  if (xml !== null) return xml

  const form = attemptForm()
  if (form !== null) return form

  return trimmed
}

function findValue(source: unknown, aliases: string[]): unknown {
  if (source === null || source === undefined) return undefined
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))
  const queue: unknown[] = Array.isArray(source) ? [...source] : [source]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === null || current === undefined) continue
    if (visited.has(current)) continue

    if (Array.isArray(current)) {
      visited.add(current)
      for (const item of current) {
        if (item !== null && typeof item === "object") {
          queue.push(item)
        }
      }
      continue
    }

    if (!isPlainObject(current)) continue
    visited.add(current)
    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = normalizeKey(key)
      if (normalizedAliases.includes(normalizedKey)) {
        if (Array.isArray(value)) {
          const firstUseful = value.find((item) => item !== null && item !== undefined)
          if (firstUseful !== undefined) {
            return firstUseful
          }
        } else {
          return value
        }
      }

      if (value !== null && typeof value === "object") {
        queue.push(value)
      }
    }
  }

  return undefined
}

function normalizePayload(raw: unknown) {
  const root = Array.isArray(raw)
    ? raw.find((item) => isPlainObject(item)) ?? raw[0]
    : raw

  if (!isPlainObject(root)) {
    if (typeof root === "string" && root.trim()) {
      return { extra: root.trim() }
    }
    return {}
  }

  const normalized: Record<string, unknown> = {}

  for (const [targetKey, aliases] of Object.entries(FIELD_ALIASES)) {
    const value = findValue(root, aliases)
    if (value !== undefined) {
      normalized[targetKey] = targetKey === "epc" && typeof value !== "string"
        ? String(value)
        : value
    }
  }

  if (normalized.extra === undefined) {
    normalized.extra = root
  }

  return normalized
}

function toOptionalNumber(value: string | number | undefined) {
  if (value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid numeric value")
  }
  return numeric
}

function toOptionalRssi(value: string | number | undefined) {
  if (value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid RSSI value")
  }
  return numeric
}

function normalizeTimestamp(value: string | number | undefined) {
  if (value === undefined) {
    return new Date()
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp")
  }
  return date
}

function formatMovement(row: MovementRow) {
  return {
    id: Number(row.id),
    timestamp: row.ts instanceof Date ? row.ts.toISOString() : new Date(row.ts).toISOString(),
    tipo: row.tipo,
    epc: row.epc,
    personaId: row.persona_id === null ? null : Number(row.persona_id),
    objetoId: row.objeto_id === null ? null : Number(row.objeto_id),
    puertaId: row.puerta_id === null ? null : Number(row.puerta_id),
    lectorId: row.lector_id === null ? null : Number(row.lector_id),
    antenaId: row.antena_id === null ? null : Number(row.antena_id),
    rssi: row.rssi === null ? null : Number(row.rssi),
    direccion: row.direccion,
    motivo: row.motivo,
    extra: row.extra,
  }
}

export async function POST(req: NextRequest) {
  let rawBody = ""
  try {
    rawBody = await req.text()
  } catch (error) {
    return NextResponse.json({ error: "Failed to read request body", details: (error as Error).message }, { status: 400 })
  }

  const contentType = req.headers.get("content-type") ?? ""
  logDebug("Incoming request", { contentType, rawPreview: rawBody.slice(0, 1000) })

  const coerced = coercePayload(rawBody, contentType)
  logDebug("Coerced payload", coerced)
  const normalizedPayload = normalizePayload(coerced)
  logDebug("Normalized payload", normalizedPayload)

  const parsed = payloadSchema.safeParse(normalizedPayload)

  if (!parsed.success) {
    logDebug("Validation failed", parsed.error.flatten())
    return NextResponse.json({
      ok: false,
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    }, { status: 200 })
  }

  try {
    const { epc, timestamp, tipo, personaId, objetoId, puertaId, lectorId, antenaId, rssi, direccion, motivo, extra } = parsed.data

    const ts = normalizeTimestamp(timestamp)
    const persona = toOptionalNumber(personaId)
    const objeto = toOptionalNumber(objetoId)
    const puerta = toOptionalNumber(puertaId)
    const lector = toOptionalNumber(lectorId)
    const antena = toOptionalNumber(antenaId)
    const signal = toOptionalRssi(rssi)

    const extraPayload = (() => {
      if (extra === undefined) return null
      if (typeof extra === "string") {
        try {
          return JSON.parse(extra)
        } catch {
          return extra
        }
      }
      return extra
    })()

    const [movement] = await query<MovementRow>(
      `INSERT INTO movimientos (
        ts,
        tipo,
        epc,
        persona_id,
        objeto_id,
        puerta_id,
        lector_id,
        antena_id,
        rssi,
        direccion,
        motivo,
        extra
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, ts, tipo, epc, persona_id, objeto_id, puerta_id, lector_id, antena_id, rssi, direccion, motivo, extra, created_at`,
  [ts, tipo ?? null, epc, persona, objeto, puerta, lector, antena, signal, direccion ?? null, motivo ?? null, extraPayload],
    )

    if (!movement) {
      return NextResponse.json({ error: "Movement record not created" }, { status: 500 })
    }

    const formatted = formatMovement(movement)

    const io = getSocketServer()
    io?.emit("rfid-event", formatted)

    logDebug("Movement stored", formatted)

    return NextResponse.json({ movement: formatted })
  } catch (error) {
    logDebug("Processing error", (error as Error).message)
    return NextResponse.json({ error: "Failed to process RFID payload", details: (error as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "100")
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 100

  try {
    const rows = await query<MovementRow>(
      `SELECT id, ts, tipo, epc, persona_id, objeto_id, puerta_id, lector_id, antena_id, rssi, direccion, motivo, extra, created_at
       FROM movimientos
       ORDER BY ts DESC
       LIMIT $1`,
      [limit],
    )

    const movements = rows.map((row) => formatMovement(row))

    return NextResponse.json({ movements })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch RFID events", details: (error as Error).message }, { status: 500 })
  }
}
