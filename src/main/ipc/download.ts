import { ipcMain, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import { fetchVideoInfo } from '../ytdlp/parser'
import { detectPlatform, type Platform } from '../ytdlp/platform'
import { cancel as cancelQueued, enqueue } from '../ytdlp/queue'
import type { DownloadOptions } from '../ytdlp/downloader'
import { resolveOutputDir } from './settings'

export interface StartRequest {
  id: string
  url: string
  platform?: Platform
  filename?: string
  height?: number
  format?: 'mp4' | 'mkv' | 'webm'
  vcodec?: 'auto' | 'h264' | 'vp9' | 'av1'
  audioOnly?: boolean
  audioFormat?: 'mp3' | 'm4a' | 'wav'
  subtitles?: string[]
  subFormat?: 'srt' | 'vtt'
  embedSubtitles?: boolean
  trimStart?: string
  trimEnd?: string
}

export function registerDownloadIpc(): void {
  ipcMain.handle('video:info', async (_event, url: string) => {
    try {
      const info = await fetchVideoInfo(url)
      return { ok: true as const, info }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('download:start', (event, req: StartRequest) => {
    const platform = req.platform ?? detectPlatform(req.url)
    const opts: DownloadOptions = {
      id: req.id,
      url: req.url,
      outputDir: resolveOutputDir(platform),
      filename: req.filename,
      height: req.height,
      format: req.format,
      vcodec: req.vcodec,
      audioOnly: req.audioOnly,
      audioFormat: req.audioFormat,
      subtitles: req.subtitles,
      subFormat: req.subFormat,
      embedSubtitles: req.embedSubtitles,
      trimStart: req.trimStart,
      trimEnd: req.trimEnd,
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const send = (channel: string, payload: unknown): void => {
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
    }

    enqueue({
      options: opts,
      onQueued: () => send('download:queued', { id: opts.id }),
      onStart: () => send('download:started', { id: opts.id }),
      callbacks: {
        onProgress: (update) => send('download:progress', { id: opts.id, ...update }),
        onStderr: (line) => send('download:log', { id: opts.id, line }),
        onComplete: (filePath) => send('download:complete', { id: opts.id, filePath }),
        onError: (error) => send('download:error', { id: opts.id, error }),
      },
    })

    return { ok: true as const, id: opts.id }
  })

  ipcMain.handle('download:cancel', (_event, id: string) => {
    return { ok: cancelQueued(id) }
  })

  ipcMain.handle('shell:show-in-folder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('shell:open-path', async (_event, dirPath: string) => {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return shell.openPath(dirPath)
  })
}
