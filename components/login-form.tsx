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

type LoginFormProps = React.ComponentProps<"div">

export function LoginForm({ className, ...props }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "No se pudo iniciar sesión",
          description: data?.message ?? "Verifica tus credenciales e intenta de nuevo.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Bienvenido",
        description: data?.user?.nombre ? `Hola, ${data.user.nombre}` : "Autenticación exitosa",
      })

      router.push("/dashboard")
    } catch (error) {
      console.error("Login error", error)
      toast({
        title: "Error inesperado",
        description: "No pudimos iniciar sesión. Intenta nuevamente más tarde.",
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
          <CardTitle className="text-xl font-semibold">Inicia sesión en tu cuenta</CardTitle>
          <CardDescription>Ingresa tu correo para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field className="gap-2">
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field className="gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Ingresando..." : "Iniciar sesión"}
                </Button>
                <Button type="button" variant="outline">
                  Iniciar con llave de acceso
                </Button>
                <FieldDescription className="text-center">
                  Acceso únicamente para cuentas existentes. Solicita altas al administrador.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
