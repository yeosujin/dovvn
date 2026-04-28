import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface ProgressPayload {
  id: string
  percent: string
  speed: string
  eta: string
  downloaded: string
  total: string
}

export interface CompletePayload {
  id: string
  filePath: string | null
}

export interface ErrorPayload {
  id: string
  error: string
}

export interface LogPayload {
  id: string
  line: string
}

export interface QueuedPayload {
  id: string
}

export interface StartedPayload {
  id: string
}

export type VideoCodec = 'auto' | 'h264' | 'vp9' | 'av1'
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
  defaultVcodec: VideoCodec
  defaultAudioOnly: boolean
  defaultAudioFormat: 'mp3' | 'm4a' | 'wav'
  defaultSubtitles: string[]
  defaultSubFormat: SubtitleFormat
  defaultEmbedSubtitles: boolean
  completionNotify: boolean
  lastSeenVersion: string | null
  lastReleaseNotes: ReleaseNotesEntry | null
}

export interface DownloadPreset {
  id: string
  name: string
  height: number | null
  format: 'mp4' | 'mkv' | 'webm'
  vcodec: VideoCodec
  audioOnly: boolean
  audioFormat: 'mp3' | 'm4a' | 'wav'
  subtitles: string[]
  subFormat: SubtitleFormat
  embedSubtitles: boolean
  createdAt: number
}

export interface DownloadStartOptions {
  id: string
  url: string
  platform?: string
  filename?: string
  height?: number
  format?: 'mp4' | 'mkv' | 'webm'
  vcodec?: VideoCodec
  audioOnly?: boolean
  audioFormat?: 'mp3' | 'm4a' | 'wav'
  subtitles?: string[]
  subFormat?: SubtitleFormat
  embedSubtitles?: boolean
  /** ffmpeg/yt-dlp 호환 시간 문자열. 예: "00:01:30.500" */
  trimStart?: string
  trimEnd?: string
}

export type UpdateResult =
  | { ok: true; beforeVersion: string; afterVersion: string; log: string }
  | { ok: false; error: string }

export type VersionResult =
  | { ok: true; version: string }
  | { ok: false; error: string }

export interface AppUpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string | null
  releaseNotes?: string | null
}

export interface AppUpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type AppUpdateCheckResult =
  | { ok: true; version: string | null }
  | { ok: false; error: string }

export type AppUpdateDownloadResult =
  | { ok: true }
  | { ok: false; error: string }

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('video:info', url),
  startDownload: (opts: DownloadStartOptions) => ipcRenderer.invoke('download:start', opts),
  cancelDownload: (id: string) => ipcRenderer.invoke('download:cancel', id),
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-in-folder', filePath),
  openPath: (dirPath: string) => ipcRenderer.invoke('shell:open-path', dirPath),

  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  updateSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<AppSettings>,
  pickBaseDir: () => ipcRenderer.invoke('settings:pick-base-dir') as Promise<string | null>,
  clearCache: () =>
    ipcRenderer.invoke('settings:clear-cache') as Promise<
      { ok: true } | { ok: false; error: string }
    >,

  listPresets: () => ipcRenderer.invoke('preset:list') as Promise<DownloadPreset[]>,
  savePreset: (preset: DownloadPreset) =>
    ipcRenderer.invoke('preset:save', preset) as Promise<DownloadPreset[]>,
  deletePreset: (id: string) =>
    ipcRenderer.invoke('preset:delete', id) as Promise<DownloadPreset[]>,

  ytdlpVersion: () => ipcRenderer.invoke('ytdlp:version') as Promise<VersionResult>,
  ytdlpUpdate: () => ipcRenderer.invoke('ytdlp:update') as Promise<UpdateResult>,
  onUpdaterLog: (cb: (line: string) => void) => subscribe<string>('ytdlp:update:log', cb),

  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  appUpdateCheck: () => ipcRenderer.invoke('app-update:check') as Promise<AppUpdateCheckResult>,
  appUpdateDownload: () =>
    ipcRenderer.invoke('app-update:download') as Promise<AppUpdateDownloadResult>,
  appUpdateQuitAndInstall: () => ipcRenderer.invoke('app-update:quit-and-install'),
  onAppUpdateChecking: (cb: () => void) => subscribe<void>('app-update:checking', cb),
  onAppUpdateAvailable: (cb: (info: AppUpdateInfo) => void) =>
    subscribe<AppUpdateInfo>('app-update:available', cb),
  onAppUpdateNotAvailable: (cb: (info: AppUpdateInfo) => void) =>
    subscribe<AppUpdateInfo>('app-update:not-available', cb),
  onAppUpdateError: (cb: (msg: string) => void) => subscribe<string>('app-update:error', cb),
  onAppUpdateProgress: (cb: (p: AppUpdateProgress) => void) =>
    subscribe<AppUpdateProgress>('app-update:progress', cb),
  onAppUpdateDownloaded: (cb: (info: AppUpdateInfo) => void) =>
    subscribe<AppUpdateInfo>('app-update:downloaded', cb),

  onQueued: (cb: (p: QueuedPayload) => void) => subscribe<QueuedPayload>('download:queued', cb),
  onStarted: (cb: (p: StartedPayload) => void) => subscribe<StartedPayload>('download:started', cb),
  onProgress: (cb: (p: ProgressPayload) => void) => subscribe<ProgressPayload>('download:progress', cb),
  onComplete: (cb: (p: CompletePayload) => void) => subscribe<CompletePayload>('download:complete', cb),
  onError: (cb: (p: ErrorPayload) => void) => subscribe<ErrorPayload>('download:error', cb),
  onLog: (cb: (p: LogPayload) => void) => subscribe<LogPayload>('download:log', cb),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
