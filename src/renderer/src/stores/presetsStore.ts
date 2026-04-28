import { create } from 'zustand'
import type { DownloadPreset } from '../../../preload/index'

interface PresetsState {
  presets: DownloadPreset[]
  activeId: string | null
  load: () => Promise<void>
  save: (preset: DownloadPreset) => Promise<void>
  remove: (id: string) => Promise<void>
  setActive: (id: string | null) => void
}

export const usePresetsStore = create<PresetsState>((set) => ({
  presets: [],
  activeId: null,
  load: async () => {
    const list = await window.api.listPresets()
    set({ presets: list })
  },
  save: async (preset) => {
    const list = await window.api.savePreset(preset)
    set({ presets: list })
  },
  remove: async (id) => {
    const list = await window.api.deletePreset(id)
    set((s) => ({ presets: list, activeId: s.activeId === id ? null : s.activeId }))
  },
  setActive: (id) => set({ activeId: id })
}))
