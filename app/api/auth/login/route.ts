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

function isSafeIdentifier(input: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)
}

export async function POST(request: Request) {
  try {
    const expectedTenant = process.env.PG_SCHEMA
    const tenantHeader = request.headers.get("x-tenant")?.trim()

    // Si hay cabecera de tenant, debe coincidir; si no, se usa el tenant activo (PG_SCHEMA)
    if (expectedTenant && tenantHeader && tenantHeader !== expectedTenant) {
      return NextResponse.json(
        { message: "Tenant incorrecto" },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const normalizedEmail = email.trim().toLowerCase()

    const candidateSchemasEnv = process.env.PG_TENANT_SCHEMAS
    const candidateSchemas = (candidateSchemasEnv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(isSafeIdentifier)

    const schemaOrder = Array.from(
      new Set([
        ...(expectedTenant && isSafeIdentifier(expectedTenant) ? [expectedTenant] : []),
        ...candidateSchemas,
      ]),
    )

    // Descubrir esquemas tenant_% y agregarlos si no estaban configurados
    const discovered = await query<{ schema_name: string }>(
      `select schema_name from information_schema.schemata where schema_name like 'tenant_%'`,
    )
    for (const row of discovered) {
      if (row.schema_name && isSafeIdentifier(row.schema_name) && !schemaOrder.includes(row.schema_name)) {
        schemaOrder.push(row.schema_name)
      }
    }

    let user: AdminUser | null = null
    let schemaUsed: string | null = null

    if (schemaOrder.length === 0) {
      return NextResponse.json({ message: "No hay tenants configurados" }, { status: 500 })
    }

    for (const schema of schemaOrder) {
      const [found] = await query<AdminUser>(
        `SELECT id, nombre, email, username, password_hash, roles, activo, bloqueado_hasta, intentos_fallidos
         FROM ${schema}.admin_users
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [normalizedEmail],
      )

      if (found) {
        user = found
        schemaUsed = schema
        break
      }
    }

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
        tenant: schemaUsed,
        email: user.email,
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
        tenant: schemaUsed,
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
