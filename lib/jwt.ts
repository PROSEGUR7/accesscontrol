import { randomBytes } from "crypto"

const globalForJwt = globalThis as typeof globalThis & {
  __rfidJwtDevSecret?: string
}

const MIN_SECRET_LENGTH = 32

export function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET

  if (configuredSecret && configuredSecret.length >= MIN_SECRET_LENGTH) {
    return configuredSecret
  }

  if (!globalForJwt.__rfidJwtDevSecret) {
    globalForJwt.__rfidJwtDevSecret = randomBytes(32).toString("hex")
    console.warn(
      "JWT_SECRET no está definido o es demasiado corto. Se generó un secreto temporal solo para desarrollo.",
    )
  }

  return globalForJwt.__rfidJwtDevSecret
}
