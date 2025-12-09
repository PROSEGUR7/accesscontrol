import { NextResponse } from "next/server"

export const runtime = "nodejs"

const message = {
  message: "El registro de cuentas está deshabilitado. Solicita acceso al administrador del sistema.",
}

export async function POST() {
  return NextResponse.json(message, { status: 403 })
}
