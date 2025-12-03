import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { CustomCursor } from "@/components/custom-cursor"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={cn(geistSans.variable, geistMono.variable, "font-sans antialiased")}
        suppressHydrationWarning
      >
        <CustomCursor />
          {children}
          <Toaster />
      </body>
    </html>
  )
}
