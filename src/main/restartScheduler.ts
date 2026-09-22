export type RestartReason = 'app-update' | 'ytdlp-update'

export interface RestartSchedulerDeps {
  isBusy: () => boolean
  onIdle: (listener: () => void) => void
  onPendingChange?: (pending: boolean) => void
}

interface QueuedRestart {
  reason: RestartReason
  run: () => boolean
}

// 큐가 비기를 기다렸다가 재시작을 한 번만 실행한다.
// run은 재시작을 시작했으면 true, 시작하지 못했으면 false를 반환한다.
export function createRestartScheduler(deps: RestartSchedulerDeps): {
  requestRestart: (reason: RestartReason, run: () => boolean) => 'now' | 'deferred'
  isRestartPending: () => boolean
} {
  // 요청 시점부터 실제 종료 시점까지 true. 성공하면 프로세스가 곧 종료되므로 해제하지 않는다.
  let pending = false
  // 큐가 빌 때까지 미뤄 둔 요청. run이 실행되면 null이 된다.
  let queued: QueuedRestart | null = null

  const notifyPending = (value: boolean): void => {
    try {
      deps.onPendingChange?.(value)
    } catch (e) {
      console.error('[restart] 대기 상태 알림 실패', e)
    }
  }

  const execute = (req: QueuedRestart): void => {
    queued = null
    let started = false
    try {
      started = req.run()
    } catch (e) {
      console.error('[restart] 재시작 실행 실패', e)
    }
    if (!started) {
      pending = false
      notifyPending(false)
    }
  }

  deps.onIdle(() => {
    if (queued) execute(queued)
  })

  return {
    isRestartPending: () => pending,
    requestRestart: (reason, run) => {
      // 이미 실행 단계에 들어간 뒤의 요청은 무시한다.
      if (pending && !queued) return 'now'
      if (queued) {
        // 앱 업데이트는 어차피 프로세스를 재시작하므로 yt-dlp 요청보다 우선한다.
        if (reason === 'app-update' && queued.reason !== 'app-update') queued = { reason, run }
        return 'deferred'
      }
      pending = true
      notifyPending(true)
      const req = { reason, run }
      if (deps.isBusy()) {
        queued = req
        return 'deferred'
      }
      execute(req)
      return 'now'
    }
  }
}
