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
  readCount?: number | null
  lastSeen?: string | null
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
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
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
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 1000
    let isConnecting = socket.connected

    const handleConnect = () => {
      retryDelay = 1000
      isConnecting = false
      setConnected(true)
      setError(null)
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      const delay = retryDelay
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
      }
      reconnectTimer = setTimeout(() => {
        if (cancelled) return
        void connect()
      }, delay)
      retryDelay = Math.min(retryDelay * 2, 10000)
    }

  const handleDisconnect = (reason: string) => {
      isConnecting = false
      setConnected(false)
      if (reason !== "io client disconnect") {
        scheduleReconnect()
      }
    }

    const handleError = (err: Error) => {
      isConnecting = false
      setError(err.message)
      scheduleReconnect()
    }

    const handleEvent = (event: RfidEvent) => {
      setEvents((current) => [event, ...current].slice(0, bufferSize))
    }

    const handleReconnectAttempt = () => {
      setError(null)
    }

    const handleServerClear = () => {
      setEvents([])
    }

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const connect = async () => {
      if (cancelled || socket.connected || isConnecting) return
      isConnecting = true
      try {
        await ensureSocketServer()
        if (!cancelled && !socket.connected) {
          socket.connect()
        }
      } catch (err) {
        isConnecting = false
        setError((err as Error).message)
        scheduleReconnect()
      }
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleError)
  socket.on("rfid-event", handleEvent)
  socket.on("rfid-clear", handleServerClear)
    socket.io.on("reconnect_attempt", handleReconnectAttempt)

    if (socket.connected) {
      handleConnect()
    } else {
      void connect()
    }

    return () => {
      cancelled = true
      clearReconnectTimer()
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleError)
  socket.off("rfid-event", handleEvent)
  socket.off("rfid-clear", handleServerClear)
      socket.io.off("reconnect_attempt", handleReconnectAttempt)
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
