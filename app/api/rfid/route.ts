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
  epc: ["epc", "tagid", "tagvalue", "id", "tagidhex", "tagiddec", "idhex", "ih"],
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

const DEFAULT_EVENT_TYPE = "SIMPLE"

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

function coerceScalar(value: string) {
  const trimmed = value.trim()
  if (trimmed === "") return ""
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true"
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  return trimmed
}

function tryParseBareObject(raw: string) {
  const withoutBraces = raw.replace(/^\s*\{\s*/, "").replace(/\s*\}\s*$/, "")
  if (!withoutBraces) return null

  const entries = withoutBraces.split(/[\r\n;,]+/)
  const result: Record<string, unknown> = {}

  for (const entry of entries) {
    if (!entry) continue
    const [rawKey, rawValue] = entry.split(/[:=]/, 2)
    if (!rawKey) continue
    const key = rawKey.trim()
    if (!key) continue
    if (rawValue === undefined) continue
    result[key] = coerceScalar(rawValue)
  }

  return Object.keys(result).length > 0 ? result : null
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

  const bareObject = tryParseBareObject(trimmed)
  if (bareObject !== null) return bareObject

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

function hasOwnAlias(obj: SimpleObject, aliases: string[]) {
  const keys = Object.keys(obj).map((key) => normalizeKey(key))
  return aliases.some((alias) => keys.includes(normalizeKey(alias)))
}

function normalizeSinglePayload(raw: unknown) {
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

  if (normalized.epc === undefined) {
    const fallback = findValue(root, ["idhex", "id", "tagid", "tagidhex"])
    if (fallback !== undefined) {
      normalized.epc = typeof fallback === "string" ? fallback : String(fallback)
    }
  }

  if (normalized.extra === undefined) {
    normalized.extra = root
  }

  return normalized
}

function collectPayloadCandidates(raw: unknown): SimpleObject[] {
  const candidates: SimpleObject[] = []
  const stack: unknown[] = [raw]
  const visited = new Set<unknown>()

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item)
      }
      continue
    }

    if (!isPlainObject(current)) continue
    const simple = current as SimpleObject
    let candidateProduced = false

    if (hasOwnAlias(simple, FIELD_ALIASES.epc)) {
      candidates.push(simple)
      candidateProduced = true
    } else {
      const dataValue = simple.data
      if (isPlainObject(dataValue) && hasOwnAlias(dataValue, FIELD_ALIASES.epc)) {
        const merged: SimpleObject = { ...dataValue, ...simple }
        if (merged.extra === undefined) {
          merged.extra = dataValue
        }
        candidates.push(merged)
        candidateProduced = true
      }
    }

    if (!candidateProduced) {
      candidates.push(simple)
    }

    for (const value of Object.values(simple)) {
      if (value && typeof value === "object") {
        stack.push(value)
      }
    }
  }

  return candidates
}

let ensureDuplicatesPromise: Promise<void> | null = null

async function ensureDuplicateEpcAllowed() {
  if (ensureDuplicatesPromise) {
    return ensureDuplicatesPromise
  }

  ensureDuplicatesPromise = (async () => {
    try {
      await query(
        `DO $$
        DECLARE
          constraint_name text;
          index_name text;
        BEGIN
          FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'movimientos'::regclass
              AND contype = 'u'
              AND cardinality(conkey) = 1
              AND (
                SELECT attname
                FROM pg_attribute
                WHERE attrelid = conrelid AND attnum = conkey[1]
              ) = 'epc'
          LOOP
            EXECUTE format('ALTER TABLE movimientos DROP CONSTRAINT %I', constraint_name);
          END LOOP;

          FOR index_name IN
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'movimientos'
              AND schemaname = ANY(current_schemas(false))
              AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
              AND indexdef LIKE '%(epc%'
          LOOP
            EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
          END LOOP;
        END $$;`,
      )
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to drop EPC unique constraint`, error)
      ensureDuplicatesPromise = null
    }
  })()

  return ensureDuplicatesPromise
}

type InsertMovementParams = {
  ts: Date
  tipo: string | null
  epc: string
  persona: number | null
  objeto: number | null
  puerta: number | null
  lector: number | null
  antena: number | null
  signal: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
}

async function insertMovement(params: InsertMovementParams, attempt = 0): Promise<MovementRow> {
  try {
    const rows = await query<MovementRow>(
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
      [
        params.ts,
        params.tipo,
        params.epc,
        params.persona,
        params.objeto,
        params.puerta,
        params.lector,
        params.antena,
        params.signal,
        params.direccion,
        params.motivo,
        params.extra,
      ],
    )

    const [movement] = rows
    if (!movement) {
      throw new Error("Movement record not created")
    }
    return movement
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "23505" && attempt === 0) {
      console.warn(`${LOG_PREFIX} EPC duplicate detected, retrying after dropping constraints`)
      ensureDuplicatesPromise = null
      await ensureDuplicateEpcAllowed()
      return insertMovement(params, attempt + 1)
    }
    throw error
  }
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

  const candidateObjects = collectPayloadCandidates(coerced)
  const normalizedPayloads = candidateObjects.length
    ? candidateObjects.map((candidate) => normalizeSinglePayload(candidate))
    : [normalizeSinglePayload(coerced)]

  logDebug("Normalized payloads", normalizedPayloads)

  const parsedPayloads = normalizedPayloads
    .map((payload) => ({ payload, result: payloadSchema.safeParse(payload) }))
    .filter((entry) => entry.result.success) as Array<{
      payload: Record<string, unknown>
      result: { success: true; data: z.infer<typeof payloadSchema> }
    }>

  if (!parsedPayloads.length) {
    logDebug("Validation failed", normalizedPayloads)
    return NextResponse.json({
      ok: false,
      error: "Invalid payload",
      issues: normalizedPayloads,
    }, { status: 200 })
  }

  try {
  const limitedPayloads = parsedPayloads.slice(0, 50)

  const insertions = await Promise.all(limitedPayloads.map(async ({ result }) => {
      const { epc, timestamp, tipo, personaId, objetoId, puertaId, lectorId, antenaId, rssi, direccion, motivo, extra } = result.data

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

      const resolvedType = typeof tipo === "string" && tipo.trim() ? tipo.trim() : DEFAULT_EVENT_TYPE

      return insertMovement({
        ts,
        tipo: resolvedType,
        epc,
        persona,
        objeto,
        puerta,
        lector,
        antena,
        signal,
        direccion: direccion ?? null,
        motivo: motivo ?? null,
        extra: extraPayload,
      })
    }))

    const formatted = insertions.map((movement) => formatMovement(movement))

    const io = getSocketServer()
    for (const movement of formatted) {
      io?.emit("rfid-event", movement)
      logDebug("Movement stored", movement)
    }

    if (formatted.length === 1) {
      return NextResponse.json({ movement: formatted[0], count: 1 })
    }

    return NextResponse.json({ movements: formatted, count: formatted.length })
  } catch (error) {
    logDebug("Processing error", (error as Error).message)
    return NextResponse.json({ error: "Failed to process RFID payload", details: (error as Error).message }, { status: 500 })
  }
}

void ensureDuplicateEpcAllowed().catch((error) => {
  console.warn(`${LOG_PREFIX} Startup duplicate EPC guard failed`, error)
})

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

export async function DELETE(_req: NextRequest) {
  try {
  const [result] = await query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM movimientos
        RETURNING id
      )
      SELECT COUNT(*)::int AS count FROM deleted`,
    )

  const deleted = Number(result?.count ?? 0)

    const io = getSocketServer()
    io?.emit("rfid-clear")

    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to delete RFID events", details: (error as Error).message },
      { status: 500 },
    )
  }
}
