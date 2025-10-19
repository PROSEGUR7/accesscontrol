import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ message: "Sesión cerrada" })

  response.cookies.set({
    name: "rfid_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  })

  return response
}
