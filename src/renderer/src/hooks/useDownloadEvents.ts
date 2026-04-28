import { useEffect } from 'react'
import { useDownloadStore } from '../stores/downloadStore'

export function useDownloadEvents(): void {
  const updateProgress = useDownloadStore((s) => s.updateProgress)
  const setStatus = useDownloadStore((s) => s.setStatus)

  useEffect(() => {
    const offQueued = window.api.onQueued((p) => setStatus(p.id, 'queued'))
    const offStarted = window.api.onStarted((p) =>
      setStatus(p.id, 'downloading', { percent: '0%', speed: '-', eta: '-' })
    )
    const offProgress = window.api.onProgress((p) => {
      updateProgress(p.id, { percent: p.percent, speed: p.speed, eta: p.eta })
    })
    const offComplete = window.api.onComplete((p) => {
      setStatus(p.id, 'completed', { filePath: p.filePath, percent: '100%' })
    })
    const offError = window.api.onError((p) => {
      const cancelled = p.error === 'Download cancelled'
      setStatus(p.id, cancelled ? 'cancelled' : 'failed', { error: p.error })
    })

    return () => {
      offQueued()
      offStarted()
      offProgress()
      offComplete()
      offError()
    }
  }, [updateProgress, setStatus])
}
