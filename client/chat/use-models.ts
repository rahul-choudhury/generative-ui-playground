import { useEffect, useState } from "react"
import type { ModelOption, ModelsResponse } from "../../shared/protocol"

const STORAGE_KEY = "generative-ui:model"

/** localStorage can throw (private mode, blocked storage): never let it break the app. */
const storage = {
  get: () => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  set: (value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Not remembered across reloads; the selection still works.
    }
  },
}

/**
 * The models the server offers, and which one the user picked. The pick is
 * remembered in this browser; a remembered model the server no longer
 * offers falls back to the server's default.
 */
export function useModels() {
  const [models, setModels] = useState<ModelOption[]>([])
  const [selected, setSelected] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch("/api/models")
      .then((res) => (res.ok ? (res.json() as Promise<ModelsResponse>) : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return
        setModels(data.models)
        const remembered = storage.get()
        setSelected(data.models.some((m) => m.id === remembered) ? remembered! : data.default)
      })
      .catch(() => {
        // No list: the selector stays hidden and the server's default is used.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const select = (id: string) => {
    setSelected(id)
    storage.set(id)
  }

  return { models, selected, select }
}
