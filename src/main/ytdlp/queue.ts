import {
  cancelDownload as cancelActive,
  startDownload,
  type DownloadCallbacks,
  type DownloadOptions,
} from './downloader'

interface QueueEntry {
  options: DownloadOptions
  callbacks: DownloadCallbacks
  onQueued?: () => void
  onStart?: () => void
}

const waiting: QueueEntry[] = []
const active = new Map<string, QueueEntry>()
let maxConcurrent = 3
const idleListeners: Array<() => void> = []

export function setMaxConcurrent(n: number): void {
  maxConcurrent = Math.max(1, Math.min(10, n))
  drain()
}

export function getMaxConcurrent(): number {
  return maxConcurrent
}

// drain()이 유휴 상태로 끝날 때마다 호출된다. 이미 유휴일 때도, 연속으로도 호출될 수 있으므로 리스너는 멱등해야 한다.
// 알림은 drain() 끝에서만 보낸다. drain() 종료 시점에는 active를 maxConcurrent(1 이상)까지 채운 뒤이므로
// active가 비면 waiting도 비어 있고, 따라서 cancel()이 waiting 항목만 지우는 경로는 유휴 전환이 아니다.
export function onIdle(listener: () => void): void {
  idleListeners.push(listener)
}

export function isIdle(): boolean {
  return active.size === 0 && waiting.length === 0
}

export function enqueue(entry: QueueEntry): void {
  waiting.push(entry)
  entry.onQueued?.()
  drain()
}

export function cancel(id: string): boolean {
  const waitingIdx = waiting.findIndex((e) => e.options.id === id)
  if (waitingIdx !== -1) {
    const [entry] = waiting.splice(waitingIdx, 1)
    entry.callbacks.onError('Download cancelled')
    return true
  }
  if (active.has(id)) {
    return cancelActive(id)
  }
  return false
}

function drain(): void {
  while (active.size < maxConcurrent && waiting.length > 0) {
    const entry = waiting.shift()!
    active.set(entry.options.id, entry)
    entry.onStart?.()

    const wrapped: DownloadCallbacks = {
      onProgress: entry.callbacks.onProgress,
      onStderr: entry.callbacks.onStderr,
      onComplete: (filePath) => {
        active.delete(entry.options.id)
        entry.callbacks.onComplete(filePath)
        drain()
      },
      onError: (error) => {
        active.delete(entry.options.id)
        entry.callbacks.onError(error)
        drain()
      },
    }

    try {
      startDownload(entry.options, wrapped)
    } catch (e) {
      // startDownload가 동기 예외(예: 출력 폴더 생성 실패)를 던지면 항목이 active에 남아
      // 큐가 영영 비지 않으므로, 실패로 처리해 active에서 빼고 다음 항목으로 넘어간다.
      wrapped.onError(e instanceof Error ? e.message : String(e))
    }
  }

  if (isIdle()) idleListeners.forEach((listener) => listener())
}

export function getQueueSnapshot(): { waiting: string[]; active: string[] } {
  return {
    waiting: waiting.map((e) => e.options.id),
    active: Array.from(active.keys()),
  }
}
