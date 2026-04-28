import { ipcMain } from 'electron'
import { loadJsonArray, saveJson } from '../storage'

export type SubtitleFormat = 'srt' | 'vtt'

export interface DownloadPreset {
  id: string
  name: string
  height: number | null
  format: 'mp4' | 'mkv' | 'webm'
  vcodec: 'auto' | 'h264' | 'vp9' | 'av1'
  audioOnly: boolean
  audioFormat: 'mp3' | 'm4a' | 'wav'
  subtitles: string[]
  subFormat: SubtitleFormat
  embedSubtitles: boolean
  createdAt: number
}

const FILE = 'presets.json'

let presets: DownloadPreset[] = []

function migrate(raw: DownloadPreset): DownloadPreset {
  return {
    ...raw,
    subFormat: raw.subFormat ?? 'srt'
  }
}

export function initPresets(): void {
  presets = loadJsonArray<DownloadPreset>(FILE).map(migrate)
}

function persist(): void {
  saveJson(FILE, presets)
}

export function registerPresetsIpc(): void {
  ipcMain.handle('preset:list', () => presets)

  ipcMain.handle('preset:save', (_event, preset: DownloadPreset) => {
    const idx = presets.findIndex((p) => p.id === preset.id)
    if (idx >= 0) presets[idx] = preset
    else presets.push(preset)
    persist()
    return presets
  })

  ipcMain.handle('preset:delete', (_event, id: string) => {
    presets = presets.filter((p) => p.id !== id)
    persist()
    return presets
  })
}
