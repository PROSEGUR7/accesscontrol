import type { Server as HTTPServer } from "http"
import type { Socket } from "net"

import type { NextApiRequest, NextApiResponse } from "next"
import { Server as SocketIOServer } from "socket.io"

import { setSocketServer } from "@/lib/socket"

type SocketWithServer = Socket & {
  server: HTTPServer & {
    io?: SocketIOServer
  }
}

type NextApiResponseWithSocket = NextApiResponse & {
  socket: SocketWithServer
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(_req: NextApiRequest, res: NextApiResponseWithSocket) {
  const socket = res.socket

  if (!socket?.server) {
    console.error("[socket.io] HTTP server instance unavailable")
    res.status(500).end("Socket server not available")
    return
  }

  if (!socket.server.io) {
    console.log("[socket.io] Initializing Socket.IO server")
    const io = new SocketIOServer(socket.server, {
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? true,
      },
      allowEIO3: true,
    })

    io.on("connection", (socket) => {
      console.log("[socket.io] Client connected", { id: socket.id })
      socket.on("disconnect", () => {
        console.log("[socket.io] Client disconnected", { id: socket.id })
      })
    })

    socket.server.io = io
    setSocketServer(io)
  } else {
    console.log("[socket.io] Reusing existing Socket.IO server")
  }

  res.status(200).end("ok")
}
