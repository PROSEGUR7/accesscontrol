import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { CustomCursor } from "@/components/custom-cursor"
import { AssistantWidget } from "@/components/assistant/assistant-widget"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"
import { getAuthenticatedUserById, getSessionFromCookies } from "@/lib/auth"

import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  preload: false,
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
  display: "swap",
})

export const metadata: Metadata = {
  title: "Sistema de Control de Acceso RFID",
  description: "Gestión inteligente de acceso con tecnología RFID",
  generator: "v0.app",
}

function extractInitialsFrom(displayValue: string | null | undefined) {
  if (!displayValue) {
    return ""
  }

  const trimmed = displayValue.trim()
  if (!trimmed) {
    return ""
  }

  const fromWords = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)

  const candidate = fromWords || trimmed.charAt(0)
  return candidate.toUpperCase()
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getSessionFromCookies()
  let userInitial: string | undefined

  if (session?.sub) {
    const user = await getAuthenticatedUserById(session.sub)
    const displayName = user?.nombre ?? session.nombre ?? ""
    const initialsFromName = extractInitialsFrom(displayName)
    const fallbackInitial = extractInitialsFrom(user?.email ?? "")
    const resolved = initialsFromName || fallbackInitial
    if (resolved) {
      userInitial = resolved
    }
  }

  return (
    <html lang="en">
      <body
        className={cn(geistSans.variable, geistMono.variable, "font-sans antialiased")}
        suppressHydrationWarning
      >
        <CustomCursor />
        <AssistantWidget userInitial={userInitial} />
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
