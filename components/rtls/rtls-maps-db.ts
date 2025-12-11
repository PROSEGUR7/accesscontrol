
// Simple IndexedDB wrapper for storing map images as blobs
export function openRTLSMapsDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("rtls-maps-db", 1)
    request.onupgradeneeded = () => {
      const db = request.result as IDBDatabase
      if (!db.objectStoreNames.contains("maps")) {
        db.createObjectStore("maps", { keyPath: "id", autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result as IDBDatabase)
    request.onerror = () => reject(request.error)
  })
}

export function addMapToDB({ name, file }: { name: string; file: File }): Promise<number> {
  return openRTLSMapsDB().then((db: IDBDatabase) => {
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction("maps", "readwrite")
      const store = tx.objectStore("maps")
      const req = store.add({ name, file })
      req.onsuccess = () => resolve(req.result as number)
      req.onerror = () => reject(req.error)
    })
  })
}
export function getAllMapsFromDB(): Promise<any[]> {
  return openRTLSMapsDB().then((db: IDBDatabase) => {
    return new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction("maps", "readonly")
      const store = tx.objectStore("maps")
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  })
}

export function deleteMapFromDB(id: number): Promise<void> {
  return openRTLSMapsDB().then((db: IDBDatabase) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("maps", "readwrite")
      const store = tx.objectStore("maps")
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}
