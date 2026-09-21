import { createRestartScheduler } from './restartScheduler'
import { isIdle, onIdle } from './ytdlp/queue'

const scheduler = createRestartScheduler({ isBusy: () => !isIdle(), onIdle })

export const { requestRestart, isRestartPending } = scheduler
