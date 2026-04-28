import { create } from 'zustand'

export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface AppUpdateState {
  phase: AppUpdatePhase
  currentVersion: string | null
  nextVersion: string | null
  progress: number | null
  message: string | null
  initialized: boolean
  init: () => void
  check: (silent?: boolean) => Promise<void>
  download: () => Promise<void>
  install: () => void
}

let unsubscribers: Array<() => void> = []

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  phase: 'idle',
  currentVersion: null,
  nextVersion: null,
  progress: null,
  message: null,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    window.api.appVersion().then((v) => set({ currentVersion: v }))

    unsubscribers = [
      window.api.onAppUpdateChecking(() => {
        if (get().phase === 'downloaded') return
        set({ phase: 'checking', message: null, progress: null })
      }),
      window.api.onAppUpdateAvailable((info) => {
        if (get().phase === 'downloaded') return
        // autoDownload=true라 main이 자동으로 다운로드 시작. 메시지는 표시하지 않음 (사용자가 인지하지 않게).
        set({
          phase: 'available',
          nextVersion: info.version,
          message: null
        })
      }),
      window.api.onAppUpdateNotAvailable(() => {
        if (get().phase === 'downloaded') return
        set({ phase: 'idle', nextVersion: null, message: null })
      }),
      window.api.onAppUpdateError((msg) => {
        if (get().phase === 'downloaded') return
        set({ phase: 'error', message: msg })
      }),
      window.api.onAppUpdateProgress((p) => {
        if (get().phase === 'downloaded') return
        set({ phase: 'downloading', progress: Math.round(p.percent) })
      }),
      window.api.onAppUpdateDownloaded((info) => {
        set({
          phase: 'downloaded',
          nextVersion: info.version,
          progress: 100,
          message: `버전 ${info.version} 설치 준비 완료`
        })
      })
    ]

    setInterval(
      () => {
        const phase = get().phase
        if (phase === 'downloading' || phase === 'downloaded') return
        void get().check(true)
      },
      6 * 60 * 60 * 1000
    )
  },

  check: async (silent = false) => {
    if (get().phase === 'downloaded') return
    if (!silent) set({ phase: 'checking', message: null })
    const r = await window.api.appUpdateCheck()
    if (!r.ok) {
      set({ phase: 'error', message: r.error })
      return
    }
    const cur = get().currentVersion
    if (!r.version || r.version === cur) {
      if (!silent) set({ phase: 'idle', message: '이미 최신 버전입니다' })
      else set({ phase: 'idle' })
    }
  },

  download: async () => {
    set({ phase: 'downloading', progress: 0 })
    const r = await window.api.appUpdateDownload()
    if (!r.ok) {
      set({ phase: 'error', message: r.error })
    }
  },

  install: () => {
    window.api.appUpdateQuitAndInstall()
  }
}))

export function disposeAppUpdateStore(): void {
  unsubscribers.forEach((u) => u())
  unsubscribers = []
}
