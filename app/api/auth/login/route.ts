import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"

import { query } from "@/lib/db"
import { getJwtSecret } from "@/lib/jwt"

export const runtime = "nodejs"

const loginSchema = z.object({
  email: z.string().email({ message: "El correo electrónico no es válido" }).trim(),
  password: z.string().min(1, { message: "La contraseña es obligatoria" }),
})

type AdminUser = {
  id: number
  nombre: string
  email: string
  username: string
  password_hash: string
  roles: string[] | null
  activo: boolean
  bloqueado_hasta: Date | string | null
  intentos_fallidos: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const normalizedEmail = email.trim().toLowerCase()

    const [user] = await query<AdminUser>(
      `SELECT id, nombre, email, username, password_hash, roles, activo, bloqueado_hasta, intentos_fallidos
       FROM tenant_base.admin_users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [normalizedEmail],
    )

    if (!user) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 })
    }

    if (!user.activo) {
      return NextResponse.json(
        { message: "Tu cuenta está desactivada. Contacta al administrador." },
        { status: 403 },
      )
    }

    const blockedUntil = user.bloqueado_hasta ? new Date(user.bloqueado_hasta) : null

    if (blockedUntil && blockedUntil.getTime() > Date.now()) {
      const until = blockedUntil.toLocaleString("es-MX")
      return NextResponse.json(
        { message: `La cuenta está bloqueada hasta ${until}.` },
        { status: 423 },
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 })
    }

    const secret = getJwtSecret()

    const token = jwt.sign(
      {
        sub: user.id,
        nombre: user.nombre,
        roles: user.roles ?? [],
      },
      secret,
      { expiresIn: "1d" },
    )

    const response = NextResponse.json({
      message: "Autenticación exitosa",
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        roles: user.roles ?? [],
      },
    })

    response.cookies.set({
      name: "rfid_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      const [first] = error.issues
      return NextResponse.json({ message: first?.message ?? "Datos inválidos" }, { status: 400 })
    }

    console.error("Error during login", error)
    return NextResponse.json(
      { message: "Ha ocurrido un error al iniciar sesión" },
      { status: 500 },
    )
  }
}
