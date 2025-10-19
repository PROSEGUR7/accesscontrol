"use client"

import { useEffect, useMemo, useState } from "react"
import { io, type Socket } from "socket.io-client"

export type RfidEvent = {
  id: number
  timestamp: string
  tipo: string | null
  epc: string | null
  personaId: number | null
  objetoId: number | null
  puertaId: number | null
  lectorId: number | null
  antenaId: number | null
  rssi: number | null
  direccion: string | null
  motivo: string | null
  extra: unknown
}

type UseRfidStreamOptions = {
  bufferSize?: number
}

declare global {
  interface Window {
    __rfidSocket?: Socket
    __rfidSocketInit?: Promise<void>
  }
}

const SOCKET_PATH = "/api/socketio"

async function ensureSocketServer() {
  if (typeof window === "undefined") return

  if (!window.__rfidSocketInit) {
    window.__rfidSocketInit = fetch(SOCKET_PATH)
      .then(() => undefined)
      .catch((error) => {
        console.error("No se pudo inicializar socket.io", error)
        throw error
      })
  }

  try {
    await window.__rfidSocketInit
  } catch {
    // silencioso: el estado de error se maneja en el hook
  }
}

function getClientSocket() {
  if (typeof window === "undefined") {
    throw new Error("useRfidStream must run in a browser environment")
  }

  if (!window.__rfidSocket) {
    window.__rfidSocket = io({
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      autoConnect: false,
    })
  }

  return window.__rfidSocket
}

export function useRfidStream(options?: UseRfidStreamOptions) {
  const bufferSize = options?.bufferSize ?? 25
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<RfidEvent[]>([])

  useEffect(() => {
    const socket = getClientSocket()
    let cancelled = false

    const handleConnect = () => {
      setConnected(true)
      setError(null)
    }

    const handleDisconnect = () => {
      setConnected(false)
    }

    const handleError = (err: Error) => {
      setError(err.message)
    }

    const handleEvent = (event: RfidEvent) => {
      setEvents((current) => [event, ...current].slice(0, bufferSize))
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleError)
    socket.on("rfid-event", handleEvent)

    const connect = async () => {
      try {
        await ensureSocketServer()
        if (!cancelled && !socket.connected) {
          socket.connect()
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      }
    }

    if (socket.connected) {
      handleConnect()
    } else {
      void connect()
    }

    return () => {
      cancelled = true
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleError)
      socket.off("rfid-event", handleEvent)
    }
  }, [bufferSize])

  return useMemo(() => ({
    connected,
    error,
    events,
    lastEvent: events[0] ?? null,
    clear: () => setEvents([]),
  }), [connected, error, events])
}
