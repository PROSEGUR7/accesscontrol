"use client"


import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import RTLSMapManager from "@/components/rtls/rtls-map-manager"
// Cargar Leaflet dinámicamente para evitar problemas SSR
const Map = dynamic(() => import("@/components/rtls/rtls-map"), { ssr: false })

export default function RTLSPage() {
  // Estado para posiciones en tiempo real
  const [positions] = useState([])
  const [mapImage, setMapImage] = useState(null)

  useEffect(() => {
    // Aquí se conectará a WebSocket para recibir posiciones
    // Ejemplo: setPositions([{ epc: "E2000017221101441890B0A1", x: 10, y: 20, timestamp: Date.now() }])
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">RTLS (Localización en Tiempo Real)</h2>
      <p className="text-muted-foreground mb-2">Visualización de etiquetas RFID en tiempo real sobre el plano.</p>
      <RTLSMapManager onSelect={(img) => setMapImage(img ? img.url : null)} />
      <div className="h-[500px] w-full rounded border overflow-hidden">
        <Map positions={positions} mapImage={mapImage} />
      </div>
    </div>
  )
}
