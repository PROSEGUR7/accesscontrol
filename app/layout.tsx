import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { CustomCursor } from "@/components/custom-cursor"

import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

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
      <body className="font-sans antialiased cursor-none" suppressHydrationWarning>
        <CustomCursor />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
