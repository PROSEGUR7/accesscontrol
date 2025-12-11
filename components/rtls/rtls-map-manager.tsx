"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { addMapToDB, getAllMapsFromDB, deleteMapFromDB } from "./rtls-maps-db"



export default function RTLSMapManager({ onSelect }) {
  const [maps, setMaps] = useState([])
  const [selected, setSelected] = useState(null)

  // Cargar mapas desde IndexedDB al montar
  useEffect(() => {
    getAllMapsFromDB().then((all) => {
      setMaps(all)
      if (all.length > 0) setSelected(all[0].id)
    })
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await addMapToDB({ name: file.name, file })
    const all = await getAllMapsFromDB()
    setMaps(all)
    setSelected(all[all.length - 1].id)
    if (onSelect) onSelect({ name: file.name, url: URL.createObjectURL(file) })
  }

  const handleSelect = (map) => {
    setSelected(map.id)
    if (onSelect) onSelect({ name: map.name, url: URL.createObjectURL(map.file) })
  }

  const handleDelete = async (id) => {
    await deleteMapFromDB(id)
    const all = await getAllMapsFromDB()
    setMaps(all)
    if (all.length > 0) {
      setSelected(all[0].id)
      if (onSelect) onSelect({ name: all[0].name, url: URL.createObjectURL(all[0].file) })
    } else {
      setSelected(null)
      if (onSelect) onSelect(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      <label className="font-semibold">Planos disponibles:</label>
      <div className="flex gap-2 flex-wrap">
        {maps.map((map) => (
          <div key={map.id} className="flex items-center gap-1">
            <Button
              variant={selected === map.id ? "default" : "outline"}
              onClick={() => handleSelect(map)}
            >
              {map.name}
            </Button>
            <button
              className="text-red-500 hover:text-red-700 px-1"
              title="Eliminar"
              onClick={() => handleDelete(map.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <label htmlFor="map-upload" className="mt-2 inline-block px-4 py-2 border rounded cursor-pointer bg-white hover:bg-gray-100 font-medium text-center w-fit">
        Subir plano...
        <input id="map-upload" type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </label>
    </div>
  )
}
