import type { Server as SocketIOServer } from "socket.io"

type GlobalWithIO = typeof globalThis & {
  __socketIO?: SocketIOServer
}

const globalForIO = globalThis as GlobalWithIO

export function setSocketServer(io: SocketIOServer) {
  globalForIO.__socketIO = io
}

export function getSocketServer() {
  return globalForIO.__socketIO
}
