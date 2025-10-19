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
    res.status(500).end("Socket server not available")
    return
  }

  if (!socket.server.io) {
    const io = new SocketIOServer(socket.server, {
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? true,
      },
    })

    io.on("connection", (socket) => {
      socket.on("disconnect", () => {
        // no-op: keeping hook for future cleanup needs
      })
    })

    socket.server.io = io
    setSocketServer(io)
  }

  res.end()
}
