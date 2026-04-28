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

export function setMaxConcurrent(n: number): void {
  maxConcurrent = Math.max(1, Math.min(10, n))
  drain()
}

export function getMaxConcurrent(): number {
  return maxConcurrent
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

    startDownload(entry.options, wrapped)
  }
}

export function getQueueSnapshot(): { waiting: string[]; active: string[] } {
  return {
    waiting: waiting.map((e) => e.options.id),
    active: Array.from(active.keys()),
  }
}
