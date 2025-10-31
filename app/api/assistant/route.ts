import { NextResponse } from "next/server"

import { query } from "@/lib/db"

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b"
const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"

type OllamaMessage = {
  role: string
  content: string
}

type AssistantRequestPayload = {
  system?: string
  messages: OllamaMessage[]
}

export async function POST(request: Request) {
  let payload: AssistantRequestPayload

  try {
    payload = (await request.json()) as AssistantRequestPayload
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo leer la solicitud", details: (error as Error).message },
      { status: 400 },
    )
  }

  const sanitizedMessages = Array.isArray(payload?.messages)
    ? payload.messages
        .filter((message): message is OllamaMessage =>
          Boolean(message && typeof message.role === "string" && typeof message.content === "string"),
        )
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        }))
        .filter((message) => message.content.length > 0)
    : []

  if (sanitizedMessages.length === 0) {
    return NextResponse.json(
      { error: "La conversación está vacía. Envía al menos un mensaje." },
      { status: 400 },
    )
  }

  const domainContextMessages = await buildDomainContextMessages(sanitizedMessages)

  const requestMessages: OllamaMessage[] = payload.system
    ? [
        {
          role: "system",
          content: payload.system,
        },
        ...domainContextMessages,
        ...sanitizedMessages,
      ]
    : [...domainContextMessages, ...sanitizedMessages]

  try {
    const response = await fetch(`${DEFAULT_BASE_URL.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        stream: false,
        messages: requestMessages,
        keep_alive: "5m",
      }),
    })

    if (!response.ok) {
      const errorPayload = await safeParseJson(response)
      return NextResponse.json(
        {
          error: "La puerta de enlace de Ollama rechazó la solicitud",
          details: errorPayload ?? { status: response.status, statusText: response.statusText },
        },
        { status: 502 },
      )
    }

    const data = await response.json()
    const message = normalizeOllamaResponse(data)

    if (!message) {
      return NextResponse.json(
        { error: "No se recibió una respuesta válida del modelo" },
        { status: 502 },
      )
    }

    return NextResponse.json({ message })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al comunicarse con Ollama",
        details: (error as Error).message,
      },
      { status: 503 },
    )
  }
}

async function safeParseJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const MAX_CONTEXT_CHARS = 3000
const DOOR_KEYWORDS = ["puerta", "puertas", "door", "porton", "portón"] as const
const EPC_KEYWORDS = ["epc", "rfid", "tag", "etiqueta"] as const
const PERSON_KEYWORDS = [
  "persona",
  "personas",
  "personal",
  "empleado",
  "empleada",
  "empleados",
  "colaborador",
  "colaboradora",
  "colaboradores",
  "suspendido",
  "suspendida",
  "suspendidos",
  "habilitado",
  "habilitada",
  "habilitados",
  "bloqueado",
  "bloqueada",
  "bloqueados",
] as const
const DOOR_OBJECT_TYPES = ["puerta", "door"] as const
const EPC_DETAIL_LIMIT = 25
const PERSON_DETAIL_LIMIT = 25
const ACTION_KEYWORDS = [
  "registrar",
  "crear",
  "actualizar",
  "editar",
  "eliminar",
  "borrar",
  "modificar",
  "agregar",
  "añadir",
  "dar de alta",
  "dar de baja",
] as const

async function buildDomainContextMessages(messages: OllamaMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")
  if (!lastUserMessage) return []

  const normalized = lastUserMessage.content.toLowerCase()
  const contexts: string[] = []

  try {
    if (containsKeyword(normalized, DOOR_KEYWORDS)) {
      const doorContext = await buildDoorContext()
      if (doorContext) {
        contexts.push(doorContext)
      }
    }

    if (containsKeyword(normalized, EPC_KEYWORDS)) {
      const epcContext = await buildEpcContext()
      if (epcContext) {
        contexts.push(epcContext)
      }
    }

    if (containsKeyword(normalized, PERSON_KEYWORDS)) {
      const personContext = await buildPersonContext()
      if (personContext) {
        contexts.push(personContext)
      }
    }

    if (containsKeyword(normalized, ACTION_KEYWORDS)) {
      contexts.push(
        "Recuerda: no tienes permisos para crear, actualizar ni eliminar datos. Siempre informa que eres un asistente de consulta y describe los pasos manuales para hacerlo en la plataforma en lugar de confirmarlo como realizado.",
      )
    }
  } catch (error) {
    console.error("assistant domain context error", error)
  }

  if (contexts.length === 0) {
    return []
  }

  const content = truncate(
    `Contexto de datos internos disponible para responder:
${contexts.join("\n\n")}

Utiliza solo esta información para contestar. Si te piden totales o métricas, entrega los valores numéricos exactos. Si un dato no aparece, indícalo explícitamente.`,
    MAX_CONTEXT_CHARS,
  )

  return [
    {
      role: "system",
      content,
    },
  ]
}

async function buildDoorContext() {
  const blocks: string[] = []

  const doors = await query<{
    id: number
    nombre: string | null
    descripcion: string | null
    ubicacion: string | null
    activa: boolean | null
  }>(
    `SELECT id, nombre, descripcion, ubicacion, activa
     FROM puertas
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 10`,
  )

  if (doors.length > 0) {
    const activeCount = doors.filter((door) => door.activa === true).length
    const inactiveCount = doors.filter((door) => door.activa === false).length
    const unknownCount = doors.length - activeCount - inactiveCount

    const summaryLines = [
      `Total de puertas: ${doors.length}`,
      `Activas: ${activeCount}`,
      `Inactivas: ${inactiveCount}`,
    ]

    if (unknownCount > 0) {
      summaryLines.push(`Sin dato de estado: ${unknownCount}`)
    }

    blocks.push(`Resumen de estado de puertas:\n${summaryLines.join("\n")}`)

    if (inactiveCount === 0) {
      blocks.push("Nota: no hay puertas marcadas como inactivas en la base de datos de puertas.")
    }

    const lines = doors.map((door) => {
      const name = door.nombre?.trim() || `Puerta ${door.id}`
      const ubicacion = door.ubicacion?.trim() || "sin ubicación"
      const estado = door.activa === true ? "activa" : door.activa === false ? "inactiva" : "sin dato"
      const descripcion = door.descripcion?.trim()
      const details = [
        `Ubicación: ${ubicacion}`,
        `Estado: ${estado}`,
        descripcion ? `Descripción: ${descripcion}` : null,
      ].filter(Boolean)
      return `- ${name} (ID ${door.id}) · ${details.join(" · ")}`
    })

    blocks.push(`Puertas registradas (tabla puertas):\n${lines.join("\n")}`)
  } else {
    blocks.push("No hay puertas registradas en la tabla puertas.")
  }

  const doorAssets = await query<{
    id: number
    nombre: string | null
    rfid_epc: string | null
    codigo_activo: string | null
    ubicacion: string | null
  }>(
    `SELECT o.id,
            o.nombre,
            o.rfid_epc,
            o.codigo_activo,
            u.nombre AS ubicacion
     FROM objetos o
     LEFT JOIN ubicaciones u ON u.id = o.ubicacion_id
     WHERE lower(o.tipo) = ANY($1)
     ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
     LIMIT 10`,
    [DOOR_OBJECT_TYPES],
  )

  if (doorAssets.length > 0) {
    const lines = doorAssets.map((asset) => {
      const name = asset.nombre?.trim() || `Activo ${asset.id}`
      const epc = asset.rfid_epc?.trim() || "sin EPC asignado"
      const codigo = asset.codigo_activo?.trim() || "sin código"
      const ubicacion = asset.ubicacion?.trim()
      const details = [`EPC: ${epc}`, `Código: ${codigo}`]
      if (ubicacion) {
        details.push(`Ubicación: ${ubicacion}`)
      }
      return `- ${name} (ID ${asset.id}) · ${details.join(" · ")}`
    })

    blocks.push(`Activos etiquetados como puertas (tabla objetos):\n${lines.join("\n")}`)
  }

  if (blocks.length === 0) {
    return "No se encontraron registros de puertas ni activos etiquetados como puertas en la base de datos."
  }

  return blocks.join("\n\n")
}

async function buildEpcContext() {
  const blocks: string[] = []

  const [objectCounts] = await query<{ total: string; distinct_count: string }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT rfid_epc)::int AS distinct_count
     FROM objetos
     WHERE rfid_epc IS NOT NULL AND length(trim(rfid_epc)) > 0`,
  )

  const [personCounts] = await query<{ total: string; distinct_count: string }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT rfid_epc)::int AS distinct_count
     FROM personas
     WHERE rfid_epc IS NOT NULL AND length(trim(rfid_epc)) > 0`,
  )

  const countLines: string[] = []
  if (objectCounts) {
    const total = Number(objectCounts.total) || 0
    const distinct = Number(objectCounts.distinct_count) || 0
    countLines.push(`Objetos con EPC: ${total} registros, ${distinct} EPC únicos`)
  }
  if (personCounts) {
    const total = Number(personCounts.total) || 0
    const distinct = Number(personCounts.distinct_count) || 0
    countLines.push(`Personas con EPC: ${total} registros, ${distinct} EPC únicos`)
  }

  if (countLines.length > 0) {
    blocks.push(`Conteo actual de EPC registrados:\n${countLines.join("\n")}`)
  }

  const objectSamples = await query<{
    id: number
    nombre: string | null
    tipo: string | null
    rfid_epc: string | null
  }>(
    `SELECT id, nombre, tipo, rfid_epc
     FROM objetos
     WHERE rfid_epc IS NOT NULL AND length(trim(rfid_epc)) > 0
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [EPC_DETAIL_LIMIT],
  )

  if (objectSamples.length > 0) {
    const lines = objectSamples.map((item, index) => {
      const name = item.nombre?.trim() || `Activo ${item.id}`
      const tipo = item.tipo?.trim() || "sin tipo"
      const epc = item.rfid_epc?.trim() ?? ""
      return `${index + 1}. ${name} (ID ${item.id}, tipo ${tipo}) · EPC ${epc}`
    })
    blocks.push(`Listado de EPC asignados a objetos:\n${lines.join("\n")}`)
  }

  const personSamples = await query<{
    id: number
    nombre: string | null
    rfid_epc: string | null
  }>(
    `SELECT id, nombre, rfid_epc
     FROM personas
     WHERE rfid_epc IS NOT NULL AND length(trim(rfid_epc)) > 0
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [EPC_DETAIL_LIMIT],
  )

  if (personSamples.length > 0) {
    const lines = personSamples.map((item, index) => {
      const name = item.nombre?.trim() || `Persona ${item.id}`
      const epc = item.rfid_epc?.trim() ?? ""
      return `${index + 1}. ${name} (ID ${item.id}) · EPC ${epc}`
    })
    blocks.push(`Listado de EPC asignados a personas:\n${lines.join("\n")}`)
  }

  if (blocks.length === 0) {
    return "No se encontraron EPC registrados en objetos ni personas."
  }

  return blocks.join("\n\n")
}

async function buildPersonContext() {
  const summary = await query<{
    total: string
    habilitados: string
    deshabilitados: string
  }>(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN habilitado THEN 1 ELSE 0 END)::int AS habilitados,
            SUM(CASE WHEN NOT habilitado THEN 1 ELSE 0 END)::int AS deshabilitados
     FROM personas`,
  )

  const [row] = summary
  const total = Number(row?.total ?? 0)
  const habilitados = Number(row?.habilitados ?? 0)
  const deshabilitados = Number(row?.deshabilitados ?? 0)
  const blocks: string[] = []

  if (total === 0) {
    blocks.push("No hay personas registradas en la base de datos de personas.")
  } else {
    blocks.push(
      `Resumen de estado de personas:\nTotal: ${total}\nHabilitadas: ${habilitados}\nDeshabilitadas (suspendidas o bloqueadas): ${deshabilitados}`,
    )

    if (deshabilitados === 0) {
      blocks.push("Nota: no hay personas deshabilitadas registradas actualmente.")
    }
  }

  const people = await query<{
    id: number
    nombre: string | null
    documento: string | null
    habilitado: boolean | null
    habilitado_desde: Date | null
    habilitado_hasta: Date | null
  }>(
    `SELECT id, nombre, documento, habilitado, habilitado_desde, habilitado_hasta
     FROM personas
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [PERSON_DETAIL_LIMIT],
  )

  if (people.length > 0) {
    const lines = people.map((person, index) => {
      const nombre = person.nombre?.trim() || `Persona ${person.id}`
      const documento = person.documento?.trim()
      const estado = person.habilitado === true ? "habilitada" : person.habilitado === false ? "deshabilitada" : "sin dato"
      const desde = person.habilitado_desde ? new Date(person.habilitado_desde).toISOString() : null
      const hasta = person.habilitado_hasta ? new Date(person.habilitado_hasta).toISOString() : null
      const details = [`Estado: ${estado}`]
      if (documento) details.push(`Documento: ${documento}`)
      if (desde) details.push(`Habilitada desde: ${desde}`)
      if (hasta) details.push(`Habilitada hasta: ${hasta}`)
      return `${index + 1}. ${nombre} (ID ${person.id}) · ${details.join(" · ")}`
    })

    blocks.push(`Personas registradas recientemente:\n${lines.join("\n")}`)
  }

  return blocks.join("\n\n")
}

function containsKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`
}

function normalizeOllamaResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return null
  }

  const maybeMessage = (data as { message?: OllamaMessage; response?: string }).message
  if (maybeMessage && typeof maybeMessage.content === "string") {
    return {
      role: maybeMessage.role ?? "assistant",
      content: maybeMessage.content.trim(),
    }
  }

  const fallback = (data as { response?: string }).response
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return {
      role: "assistant",
      content: fallback.trim(),
    }
  }

  return null
}
