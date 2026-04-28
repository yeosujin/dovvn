import { ipcMain, app, dialog, BrowserWindow, session } from 'electron'
import path from 'path'
import { getMaxConcurrent, setMaxConcurrent } from '../ytdlp/queue'
import { PLATFORM_DIR_NAMES, type Platform } from '../ytdlp/platform'
import { loadJson, saveJson } from '../storage'
import { runYtDlpOnce } from '../ytdlp/runner'

export type DefaultVideoCodec = 'auto' | 'h264' | 'vp9' | 'av1'

export type SubtitleFormat = 'srt' | 'vtt'

export interface ReleaseNotesEntry {
  version: string
  notes: string
  installedAt: number
}

export interface AppSettings {
  baseDir: string
  usePlatformSubfolder: boolean
  maxConcurrent: number
  defaultHeight: number | null
  defaultFormat: 'mp4' | 'mkv' | 'webm'
  defaultVcodec: DefaultVideoCodec
  defaultAudioOnly: boolean
  defaultAudioFormat: 'mp3' | 'm4a' | 'wav'
  defaultSubtitles: string[]
  defaultSubFormat: SubtitleFormat
  defaultEmbedSubtitles: boolean
  completionNotify: boolean
  /** 앱 포커스 시 클립보드의 URL을 입력창에 자동 붙여넣을지 여부. */
  autoPasteClipboard: boolean
  /** 사용자가 마지막으로 What's New 토스트를 본 버전. */
  lastSeenVersion: string | null
  /** 마지막으로 설치된 업데이트의 릴리즈 노트. */
  lastReleaseNotes: ReleaseNotesEntry | null
}

const FILE = 'settings.json'

function makeDefaults(): AppSettings {
  return {
    baseDir: path.join(app.getPath('downloads'), 'Dovvn'),
    usePlatformSubfolder: true,
    maxConcurrent: 3,
    defaultHeight: 1080,
    defaultFormat: 'mp4',
    defaultVcodec: 'auto',
    defaultAudioOnly: false,
    defaultAudioFormat: 'mp3',
    defaultSubtitles: ['ko'],
    defaultSubFormat: 'srt',
    defaultEmbedSubtitles: false,
    completionNotify: true,
    autoPasteClipboard: true,
    lastSeenVersion: null,
    lastReleaseNotes: null,
  }
}

export function setLastReleaseNotes(entry: ReleaseNotesEntry | null): void {
  settings.lastReleaseNotes = entry
  persist()
}

export function setLastSeenVersion(version: string | null): void {
  settings.lastSeenVersion = version
  persist()
}

let settings: AppSettings = makeDefaults()

// 과거 기본값("VideoDownloader")을 그대로 쓰고 있던 사용자는 새 기본값("Dovvn")으로 자동 이전.
// 단, 사용자가 직접 다른 경로를 골랐다면 건드리지 않는다.
function migrateLegacyBaseDir(loaded: AppSettings): AppSettings {
  const legacyDir = path.join(app.getPath('downloads'), 'VideoDownloader')
  if (loaded.baseDir === legacyDir) {
    return { ...loaded, baseDir: path.join(app.getPath('downloads'), 'Dovvn') }
  }
  return loaded
}

// 신규로 추가된 설정 필드가 과거 저장본에 없을 때 기본값을 채운다.
function fillMissingDefaults(loaded: AppSettings): AppSettings {
  const defaults = makeDefaults()
  return {
    ...defaults,
    ...loaded,
    defaultSubFormat: loaded.defaultSubFormat ?? defaults.defaultSubFormat
  }
}

export function initSettings(): void {
  const loaded = loadJson<AppSettings>(FILE, makeDefaults())
  settings = fillMissingDefaults(migrateLegacyBaseDir(loaded))
  saveJson(FILE, settings)
  setMaxConcurrent(settings.maxConcurrent)
}

export function getSettings(): AppSettings {
  return { ...settings, maxConcurrent: getMaxConcurrent() }
}

export function resolveOutputDir(platform: Platform): string {
  if (settings.usePlatformSubfolder) {
    return path.join(settings.baseDir, PLATFORM_DIR_NAMES[platform] ?? 'Other')
  }
  return settings.baseDir
}

export function isCompletionNotifyEnabled(): boolean {
  return settings.completionNotify
}

function persist(): void {
  saveJson(FILE, settings)
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_event, patch: Partial<AppSettings>) => {
    if (typeof patch.baseDir === 'string') settings.baseDir = patch.baseDir
    if (typeof patch.usePlatformSubfolder === 'boolean')
      settings.usePlatformSubfolder = patch.usePlatformSubfolder
    if (typeof patch.maxConcurrent === 'number') {
      settings.maxConcurrent = patch.maxConcurrent
      setMaxConcurrent(patch.maxConcurrent)
    }
    if (patch.defaultHeight !== undefined) settings.defaultHeight = patch.defaultHeight
    if (typeof patch.defaultFormat === 'string') settings.defaultFormat = patch.defaultFormat
    if (typeof patch.defaultVcodec === 'string') settings.defaultVcodec = patch.defaultVcodec
    if (typeof patch.defaultAudioOnly === 'boolean')
      settings.defaultAudioOnly = patch.defaultAudioOnly
    if (typeof patch.defaultAudioFormat === 'string')
      settings.defaultAudioFormat = patch.defaultAudioFormat
    if (Array.isArray(patch.defaultSubtitles))
      settings.defaultSubtitles = patch.defaultSubtitles
    if (patch.defaultSubFormat === 'srt' || patch.defaultSubFormat === 'vtt')
      settings.defaultSubFormat = patch.defaultSubFormat
    if (typeof patch.defaultEmbedSubtitles === 'boolean')
      settings.defaultEmbedSubtitles = patch.defaultEmbedSubtitles
    if (typeof patch.completionNotify === 'boolean')
      settings.completionNotify = patch.completionNotify
    if (typeof patch.autoPasteClipboard === 'boolean')
      settings.autoPasteClipboard = patch.autoPasteClipboard
    if (patch.lastSeenVersion === null || typeof patch.lastSeenVersion === 'string')
      settings.lastSeenVersion = patch.lastSeenVersion
    if (patch.lastReleaseNotes === null || (patch.lastReleaseNotes && typeof patch.lastReleaseNotes === 'object'))
      settings.lastReleaseNotes = patch.lastReleaseNotes

    persist()
    return getSettings()
  })

  ipcMain.handle('settings:pick-base-dir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const picked = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: settings.baseDir,
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    settings.baseDir = picked.filePaths[0]
    persist()
    return settings.baseDir
  })

  // 캐시 삭제: Electron 세션 HTTP 캐시(썸네일 등) + yt-dlp 자체 캐시(~/.cache/yt-dlp)
  ipcMain.handle('settings:clear-cache', async () => {
    const errors: string[] = []
    try {
      await session.defaultSession.clearCache()
      await session.defaultSession.clearCodeCaches({})
    } catch (err) {
      errors.push(`앱 캐시: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      const { code, stderr } = await runYtDlpOnce(['--rm-cache-dir'], { timeoutMs: 30_000 })
      if (code !== 0) errors.push(`yt-dlp 캐시: ${stderr.trim() || `exit ${code}`}`)
    } catch (err) {
      errors.push(`yt-dlp 캐시: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (errors.length) return { ok: false as const, error: errors.join('\n') }
    return { ok: true as const }
  })
}
