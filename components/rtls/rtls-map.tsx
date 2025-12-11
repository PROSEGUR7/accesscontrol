
import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// positions: [{ epc, x, y, timestamp }]
export default function RTLSMap({ positions, mapImage }) {
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const imageLayerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("rtls-map", {
        center: [50, 50],
        zoom: 0,
        crs: L.CRS.Simple,
        minZoom: -2,
        maxBounds: [[0, 0], [100, 100]],
      })
    }
    // Solo actualizar la imagen overlay
    if (mapImage) {
      const bounds = [[0, 0], [100, 100]]
      if (imageLayerRef.current) {
        mapRef.current.removeLayer(imageLayerRef.current)
      }
      imageLayerRef.current = L.imageOverlay(mapImage, bounds).addTo(mapRef.current)
      mapRef.current.fitBounds(bounds)
    }
    // No eliminar el mapa, solo la capa si cambia
    return () => {
      if (imageLayerRef.current) {
        mapRef.current?.removeLayer(imageLayerRef.current)
        imageLayerRef.current = null
      }
    }
  }, [mapImage])
  useEffect(() => {
    if (!mapRef.current) return
    // Limpiar marcadores previos
    Object.values(markersRef.current).forEach((marker) => marker.remove())
    markersRef.current = {}
    // Dibujar nuevas posiciones
    positions.forEach(({ epc, x, y }) => {
      const marker = L.circleMarker([y, x], {
        radius: 10,
        color: "#007bff",
        fillColor: "#007bff",
        fillOpacity: 0.7,
      }).addTo(mapRef.current)
      marker.bindTooltip(epc)
      markersRef.current[epc] = marker
    })
  }, [positions])
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleClick = (e) => {
      // Normalizar coordenadas a 0-100
      const { lat, lng } = e.latlng;
      const x = Math.max(0, Math.min(100, lng));
      const y = Math.max(0, Math.min(100, lat));
      // Mostrar popup para guardar referencia
      L.popup()
        .setLatLng([y, x])
        .setContent(`Referencia: (${x.toFixed(2)}, ${y.toFixed(2)})<br/><button id='save-ref'>Guardar</button>`)
        .openOn(map);
      setTimeout(() => {
        const btn = document.getElementById('save-ref');
        if (btn) {
          btn.onclick = () => {
            fetch('/api/referencias', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ x, y })
            });
            map.closePopup();
          };
        }
      }, 100);
    };
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [mapImage]);

  return <div id="rtls-map" style={{ width: "100%", height: "100%" }} />
}
