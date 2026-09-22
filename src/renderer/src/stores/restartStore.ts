import { create } from 'zustand'
import { useDownloadStore } from './downloadStore'

interface RestartState {
  pending: boolean
  forcing: boolean
  init: () => void
  forceRestart: () => Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useRestartStore = create<RestartState>((set, get) => ({
  pending: false,
  forcing: false,

  init: () => {
    if (unsubscribe) return
    window.api.isRestartPending().then((pending) => set({ pending }))
    unsubscribe = window.api.onRestartPendingChanged((pending) =>
      set({ pending, forcing: pending ? get().forcing : false })
    )
  },

  forceRestart: async () => {
    if (!get().pending) return
    set({ forcing: true })
    const active = useDownloadStore
      .getState()
      .items.filter((it) => it.status === 'queued' || it.status === 'downloading')
    await Promise.allSettled(active.map((it) => window.api.cancelDownload(it.id)))
    // 취소되면 큐가 비어 메인의 재시작 스케줄러가 자동으로 재시작을 실행한다.
    // 여기서 추가로 할 일은 없다 — 재시작이 성사되면 앱이 종료되며 화면이 사라진다.
  }
}))
