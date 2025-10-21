import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { CustomCursor } from "@/components/custom-cursor"
import { cn } from "@/lib/utils"

import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

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
        className={cn(geistSans.variable, geistMono.variable, "font-sans antialiased cursor-none")}
        suppressHydrationWarning
      >
        <CustomCursor />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
