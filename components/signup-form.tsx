"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type SignupFormProps = React.ComponentProps<"div">

export function SignupForm({ className, ...props }: SignupFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden. Verifica e intenta de nuevo.")
      toast({
        title: "Contraseñas no coinciden",
        description: "Verifica que ambas contraseñas sean iguales.",
        variant: "destructive",
      })
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      })

      const contentType = response.headers.get("content-type") ?? ""
      const isJson = contentType.includes("application/json")
      const data = isJson ? await response.json().catch(() => null) : null
      const rawBody = !isJson ? await response.text().catch(() => null) : null

      if (!response.ok) {
        const messageBase = data?.message ?? rawBody ?? "No se pudo crear la cuenta."
        const message = data?.detail ? `${messageBase} (${data.detail})` : messageBase
        console.error("Registro fallido", { data, rawBody, status: response.status })
        setError(message)
        toast({
          title: "Registro fallido",
          description: message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Cuenta creada",
        description: data?.user?.nombre
          ? `Bienvenido, ${data.user.nombre}.`
          : "Tu cuenta se creó correctamente.",
      })

      setError(null)
      router.push("/dashboard")
    } catch (err) {
      console.error("Register error", err)
      const message = "No pudimos completar el registro. Intenta de nuevo más tarde."
      setError(message)
      toast({
        title: "Error inesperado",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border/40 bg-card/70 backdrop-blur-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">Crea tu cuenta</CardTitle>
          <CardDescription>
            Registra tus datos para administrar accesos y llaves RFID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="full-name">Nombre completo</FieldLabel>
                <Input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="email">Correo institucional</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Field className="gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creando cuenta..." : "Registrar cuenta"}
                </Button>
                <FieldDescription className="text-center text-muted-foreground">
                  Al registrarte aceptas las políticas de uso del sistema.
                </FieldDescription>
                <FieldDescription className="text-center">
                  ¿Ya tienes una cuenta? <Link href="/">Inicia sesión</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
