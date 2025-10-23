import { setTimeout as setNodeTimeout } from "node:timers"

const DEFAULT_PROTOCOL = (process.env.FX9600_PROTOCOL ?? "http").replace(/:$/u, "").toLowerCase()
const DEFAULT_PORT = process.env.FX9600_PORT?.trim() ?? ""
const DEFAULT_TIMEOUT_MS = Number.isFinite(Number(process.env.FX9600_HTTP_TIMEOUT_MS))
  ? Number(process.env.FX9600_HTTP_TIMEOUT_MS)
  : 4000
const DEFAULT_PULSE_MS = Number.isFinite(Number(process.env.FX9600_DEFAULT_PULSE_MS))
  ? Number(process.env.FX9600_DEFAULT_PULSE_MS)
  : 250
const URL_TEMPLATE = process.env.FX9600_GPO_URL_TEMPLATE?.trim() ?? ""
const HTTP_METHOD = (process.env.FX9600_GPO_HTTP_METHOD ?? "POST").toUpperCase()
const BODY_TEMPLATE = process.env.FX9600_GPO_BODY_TEMPLATE ?? ""

function sanitizeHost(readerIp: string) {
  return readerIp.replace(/^https?:\/\//iu, "").replace(/\/$/u, "")
}

function buildUrl(readerIp: string, gpoPin: number) {
  const host = sanitizeHost(readerIp)
  if (URL_TEMPLATE) {
    return URL_TEMPLATE
      .replace(/\{\s*readerIp\s*\}/giu, host)
      .replace(/\{\s*host\s*\}/giu, host)
      .replace(/\{\s*pin\s*\}/giu, String(gpoPin))
      .replace(/\{\s*gpoPin\s*\}/giu, String(gpoPin))
      .replace(/\{\s*protocol\s*\}/giu, DEFAULT_PROTOCOL)
  }

  const portPart = DEFAULT_PORT ? `:${DEFAULT_PORT}` : ""
  return `${DEFAULT_PROTOCOL}://${host}${portPart}/api/v1/actions/gpo/${gpoPin}/pulse`
}

function buildBody(params: {
  gpoPin: number
  pulseMs: number
  postState: string
  readerIp: string
  mode: string
}) {
  if (!BODY_TEMPLATE) {
    return JSON.stringify({
      duration: params.pulseMs,
      durationMs: params.pulseMs,
      postState: params.postState,
      gpoPin: params.gpoPin,
      mode: params.mode,
    })
  }

  const host = sanitizeHost(params.readerIp)

  const replaced = BODY_TEMPLATE
    .replace(/\{\{\s*pulseMs\s*\}\}/giu, String(params.pulseMs))
    .replace(/\{\{\s*duration\s*\}\}/giu, String(params.pulseMs))
    .replace(/\{\{\s*postState\s*\}\}/giu, params.postState)
    .replace(/\{\{\s*gpoPin\s*\}\}/giu, String(params.gpoPin))
    .replace(/\{\{\s*pin\s*\}\}/giu, String(params.gpoPin))
    .replace(/\{\{\s*readerIp\s*\}\}/giu, host)
    .replace(/\{\{\s*mode\s*\}\}/giu, params.mode)

  return replaced
}

export type FxGpoCommandRequest = {
  readerIp: string
  username?: string
  password?: string
  gpoPin: number
  pulseMs?: number | null
  postStateLow?: boolean | null
  timeoutMs?: number
  mode?: string | null
}

export type FxGpoCommandResult = {
  success: boolean
  status: number | null
  message: string | null
  error: string | null
  body: string | null
  url: string
  startedAt: string
  finishedAt: string
  durationMs: number
}

export async function sendFx9600Pulse(params: FxGpoCommandRequest): Promise<FxGpoCommandResult> {
  const { readerIp, username, password, gpoPin } = params
  const pulseMs = params.pulseMs && params.pulseMs > 0 ? params.pulseMs : DEFAULT_PULSE_MS
  const postState = params.postStateLow === false ? "HIGH" : "LOW"
  const timeoutMs = params.timeoutMs && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS
  const mode = params.mode ?? "PULSE"

  const url = buildUrl(readerIp, gpoPin)
  const headers: Record<string, string> = {}

  if (HTTP_METHOD !== "GET" && HTTP_METHOD !== "HEAD") {
    headers["Content-Type"] = BODY_TEMPLATE.trim().startsWith("<") ? "text/xml" : "application/json"
  }

  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`
  }

  const controller = new AbortController()
  const timeoutHandle = setNodeTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const startedAtMs = Date.now()
  const startedAtIso = new Date(startedAtMs).toISOString()

  try {
    const body = HTTP_METHOD === "GET" || HTTP_METHOD === "HEAD"
      ? undefined
      : buildBody({ gpoPin, pulseMs, postState, readerIp, mode })

    const response = await fetch(url, {
      method: HTTP_METHOD,
      headers,
      body,
      signal: controller.signal,
    })

    const text = await response.text()
    const finishedAtMs = Date.now()
    const finishedAtIso = new Date(finishedAtMs).toISOString()

    return {
      success: response.ok,
      status: response.status,
      message: response.ok ? "Pulso enviado correctamente" : response.statusText || "Error HTTP",
      error: response.ok ? null : response.statusText || text || "Solicitud rechazada",
      body: text ? text.slice(0, 2048) : null,
      url,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      durationMs: finishedAtMs - startedAtMs,
    }
  } catch (error) {
    const finishedAtMs = Date.now()
    const finishedAtIso = new Date(finishedAtMs).toISOString()
    const err = error as Error

    const isAbort = err.name === "AbortError"
    return {
      success: false,
      status: null,
      message: isAbort ? "Tiempo de espera agotado al contactar el lector" : err.message,
      error: err.message,
      body: null,
      url,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      durationMs: finishedAtMs - startedAtMs,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}
