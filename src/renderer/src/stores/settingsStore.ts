import { create } from 'zustand'
import type { AppSettings } from '../../../preload/index'

interface SettingsState {
  settings: AppSettings | null
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  pickBaseDir: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  load: async () => {
    const s = await window.api.getSettings()
    set({ settings: s })
  },
  update: async (patch) => {
    const s = await window.api.updateSettings(patch)
    set({ settings: s })
  },
  pickBaseDir: async () => {
    const dir = await window.api.pickBaseDir()
    if (dir) {
      const s = await window.api.updateSettings({ baseDir: dir })
      set({ settings: s })
    }
  }
}))
