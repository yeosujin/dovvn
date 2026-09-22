import { createRestartScheduler } from './restartScheduler'
import { isIdle, onIdle } from './ytdlp/queue'

const pendingListeners: Array<(pending: boolean) => void> = []

const scheduler = createRestartScheduler({
  isBusy: () => !isIdle(),
  onIdle,
  onPendingChange: (pending) => pendingListeners.forEach((listener) => listener(pending))
})

export const { requestRestart, isRestartPending } = scheduler

export function onRestartPendingChange(listener: (pending: boolean) => void): void {
  pendingListeners.push(listener)
}
