import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DownloadItem, DownloadStatus, VideoInfo } from '../types'
import type { DownloadOptionsValue } from '../components/DownloadOptions'

interface DownloadState {
  items: DownloadItem[]
  addItem: (item: DownloadItem) => void
  updateProgress: (id: string, patch: { percent: string; speed: string; eta: string }) => void
  setStatus: (id: string, status: DownloadStatus, extra?: Partial<DownloadItem>) => void
  resetForRetry: (id: string) => void
  removeItem: (id: string) => void
  clearFinished: () => void
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((s) => ({ items: [item, ...s.items] })),
      updateProgress: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, ...patch, status: 'downloading' as const } : it
          )
        })),
      setStatus: (id, status, extra) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, status, ...extra } : it))
        })),
      resetForRetry: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'queued' as const,
                  percent: '0%',
                  speed: '-',
                  eta: '-',
                  error: null
                }
              : it
          )
        })),
      removeItem: (id) =>
        set((s) => ({
          items: s.items.filter((it) => it.id !== id)
        })),
      clearFinished: () =>
        set((s) => ({
          items: s.items.filter(
            (it) =>
              it.status !== 'completed' && it.status !== 'failed' && it.status !== 'cancelled'
          )
        }))
    }),
    {
      name: 'dovvn-downloads',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // 앱을 다시 켰을 때 "downloading"/"queued" 였던 항목은 실제 프로세스가 없으므로
      // 중단됨(failed) 상태로 바꿔 재시도 가능하게 한다.
      // 더불어 구버전에서 저장된 항목은 신규 옵션 필드(subFormat 등)가 누락될 수 있어
      // 재시도 시 undefined가 yt-dlp로 전달되지 않도록 기본값을 채운다.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.items = state.items.map((it) => {
          const options: DownloadOptionsValue = {
            ...it.options,
            subFormat: it.options?.subFormat ?? 'srt',
            subtitles: it.options?.subtitles ?? [],
            embedSubtitles: it.options?.embedSubtitles ?? false
          }
          if (it.status === 'downloading' || it.status === 'queued') {
            return { ...it, options, status: 'failed' as const, error: '앱 종료로 중단됨' }
          }
          return { ...it, options }
        })
      }
    }
  )
)

export function createDownloadItem(info: VideoInfo, options: DownloadOptionsValue): DownloadItem {
  const customName = options.filename?.trim()
  return createItem({
    id: info.id,
    url: info.webpageUrl,
    title: customName || info.title,
    platform: info.platform,
    thumbnail: info.thumbnail,
    options
  })
}

export interface CreateItemInput {
  id: string
  url: string
  title: string
  platform: DownloadItem['platform']
  thumbnail: string | null
  options: DownloadOptionsValue
}

export function createItem(input: CreateItemInput): DownloadItem {
  return {
    id: `${input.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    url: input.url,
    title: input.title,
    platform: input.platform,
    thumbnail: input.thumbnail,
    status: 'queued',
    percent: '0%',
    speed: '-',
    eta: '-',
    filePath: null,
    error: null,
    createdAt: Date.now(),
    options: input.options
  }
}
