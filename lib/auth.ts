import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import jwt, { type JwtPayload } from "jsonwebtoken"

import { query } from "@/lib/db"
import { getJwtSecret } from "@/lib/jwt"

export const SESSION_COOKIE_NAME = "rfid_session"

export type SessionPayload = {
  sub: number
  nombre?: string
  roles?: string[]
}

type AdminUserRow = {
  id: number
  nombre: string
  email: string
  roles: string[] | null
}

export type AuthenticatedUser = {
  id: number
  nombre: string
  email: string
  roles: string[]
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null
  try {
    const secret = getJwtSecret()
    const decoded = jwt.verify(token, secret) as JwtPayload | string
    if (!decoded || typeof decoded === "string") {
      return null
    }

    const rawSub = decoded.sub
    const numericSub = typeof rawSub === "string" ? Number(rawSub) : rawSub

    if (typeof numericSub !== "number" || Number.isNaN(numericSub)) {
      return null
    }

    const nombre = typeof decoded.nombre === "string" ? decoded.nombre : undefined
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles.filter((role): role is string => typeof role === "string")
      : undefined

    return {
      sub: numericSub,
      nombre,
      roles,
    }
  } catch (error) {
    console.warn("Token de sesión inválido", error)
    return null
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  return verifySessionToken(token)
}

export function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  return verifySessionToken(token)
}

export async function getAuthenticatedUserById(userId: number): Promise<AuthenticatedUser | null> {
  try {
    const [user] = await query<AdminUserRow>(
      `SELECT id, nombre, email, roles FROM tenant_base.admin_users WHERE id = $1 LIMIT 1`,
      [userId],
    )

    if (!user) return null

    const roles = Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === "string")
      : []

    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      roles,
    }
  } catch (error) {
    console.error("Error fetching authenticated user", error)
    return null
  }
}
