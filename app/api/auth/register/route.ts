import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"

import { query } from "@/lib/db"
import { getJwtSecret } from "@/lib/jwt"

export const runtime = "nodejs"

const registerSchema = z.object({
  fullName: z.string().min(3, { message: "El nombre es obligatorio" }).max(120).trim(),
  email: z.string().email({ message: "El correo electrónico no es válido" }).trim(),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
})

type AdminUser = {
  id: number
  nombre: string
  email: string
  username: string
  roles: string[] | null
  activo: boolean
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fullName, email, password } = registerSchema.parse(body)

    const trimmedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    const [emailTaken] = await query<Pick<AdminUser, "email">>(
      `SELECT email FROM tenant_base.admin_users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [normalizedEmail],
    )

    if (emailTaken) {
      return NextResponse.json(
        { message: "Ya existe una cuenta con este correo electrónico." },
        { status: 409 },
      )
    }

    const username = normalizedEmail

    const [createdUser] = await query<AdminUser>(
      `INSERT INTO tenant_base.admin_users (nombre, email, username, password_hash, activo, intentos_fallidos)
       VALUES ($1, $2, $3, $4, true, 0)
       RETURNING id, nombre, email, username, roles, activo`,
      [trimmedName, normalizedEmail, username, await bcrypt.hash(password, 12)],
    )

    if (!createdUser) {
      return NextResponse.json({ message: "No fue posible crear la cuenta" }, { status: 500 })
    }

    const secret = getJwtSecret()

    const token = jwt.sign(
      {
        sub: createdUser.id,
        nombre: createdUser.nombre,
        roles: createdUser.roles ?? ["seguridad"],
      },
      secret,
      { expiresIn: "1d" },
    )

    const response = NextResponse.json({
      message: "Cuenta creada correctamente",
      user: {
        id: createdUser.id,
        nombre: createdUser.nombre,
        email: createdUser.email,
        username: createdUser.username,
        roles: createdUser.roles ?? ["seguridad"],
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

    if (typeof error === "object" && error !== null && "code" in error) {
      const { code } = error as { code?: string }
      if (code === "23505") {
        return NextResponse.json({ message: "Los datos proporcionados ya están registrados." }, { status: 409 })
      }
    }

    console.error("Error durante el registro", error)
    const detail = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { message: "Ha ocurrido un error al registrar la cuenta", detail },
      { status: 500 },
    )
  }
}
