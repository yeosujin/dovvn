import { useCallback } from 'react'
import {
  createDownloadItem,
  createItem,
  useDownloadStore,
  type CreateItemInput
} from '../stores/downloadStore'
import {
  timeMarkToSeconds,
  type DownloadOptionsValue,
  type TimeMark
} from '../components/DownloadOptions'
import type { DownloadItem, VideoInfo } from '../types'

function formatTimeMark(t: TimeMark): string {
  const hh = String(t.h).padStart(2, '0')
  const mm = String(t.m).padStart(2, '0')
  const ss = String(t.s).padStart(2, '0')
  const msStr = String(t.ms).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${msStr}`
}

function buildStartPayload(
  id: string,
  url: string,
  platform: string,
  options: DownloadOptionsValue
): Parameters<typeof window.api.startDownload>[0] {
  // trim은 video 모드에서만, 끝>시작인 경우만 유효.
  const trimUsable =
    options.trimEnabled &&
    !options.audioOnly &&
    timeMarkToSeconds(options.trimEnd) > timeMarkToSeconds(options.trimStart)

  return {
    id,
    url,
    platform,
    filename: options.filename && options.filename.trim() ? options.filename : undefined,
    height: options.audioOnly ? undefined : (options.height ?? undefined),
    format: options.audioOnly ? undefined : options.format,
    vcodec: options.audioOnly ? undefined : options.vcodec,
    audioOnly: options.audioOnly,
    audioFormat: options.audioOnly ? options.audioFormat : undefined,
    subtitles: options.subtitles.length > 0 ? options.subtitles : undefined,
    subFormat: options.subtitles.length > 0 ? options.subFormat : undefined,
    embedSubtitles: options.embedSubtitles,
    trimStart: trimUsable ? formatTimeMark(options.trimStart) : undefined,
    trimEnd: trimUsable ? formatTimeMark(options.trimEnd) : undefined
  }
}

export function useStartDownload(): {
  start: (info: VideoInfo, options: DownloadOptionsValue) => Promise<void>
  startBatch: (inputs: CreateItemInput[]) => Promise<void>
  retry: (item: DownloadItem) => Promise<void>
} {
  const addItem = useDownloadStore((s) => s.addItem)
  const resetForRetry = useDownloadStore((s) => s.resetForRetry)

  const start = useCallback(
    async (info: VideoInfo, options: DownloadOptionsValue) => {
      const item = createDownloadItem(info, options)
      addItem(item)
      await window.api.startDownload(
        buildStartPayload(item.id, info.webpageUrl, info.platform, options)
      )
    },
    [addItem]
  )

  const startBatch = useCallback(
    async (inputs: CreateItemInput[]) => {
      for (const input of inputs) {
        const item = createItem(input)
        addItem(item)
        // 동기적으로 순차 호출해 큐 투입 순서 보장
        await window.api.startDownload(
          buildStartPayload(item.id, item.url, item.platform, item.options)
        )
      }
    },
    [addItem]
  )

  const retry = useCallback(
    async (item: DownloadItem) => {
      resetForRetry(item.id)
      await window.api.startDownload(
        buildStartPayload(item.id, item.url, item.platform, item.options)
      )
    },
    [resetForRetry]
  )

  return { start, startBatch, retry }
}
