import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Settings, Sparkles, AlertCircle } from 'lucide-react'
import { UrlInput } from './components/UrlInput'
import { VideoInfoCard } from './components/VideoInfo'
import {
  DownloadOptionsPanel,
  defaultOptions,
  type DownloadOptionsValue
} from './components/DownloadOptions'
import { PlaylistSelector } from './components/PlaylistSelector'
import { PlaylistOptionsPanel, defaultPlaylistOptions } from './components/PlaylistOptions'
import { DownloadQueue } from './components/DownloadQueue'
import { SettingsPanel } from './components/SettingsPanel'
import { PresetBar } from './components/PresetBar'
import { Ghost } from './components/Ghost'
import { UpdatePill } from './components/UpdatePill'
import { WhatsNewToast } from './components/WhatsNewToast'
import type { ReleaseNotesEntry } from '../../preload/index'
import { useAppUpdateStore } from './stores/appUpdateStore'
import { useDownloadEvents } from './hooks/useDownloadEvents'
import { useStartDownload } from './hooks/useStartDownload'
import { useSettingsStore } from './stores/settingsStore'
import { usePresetsStore } from './stores/presetsStore'
import { useDownloadStore } from './stores/downloadStore'
import type { DownloadPreset } from '../../preload/index'
import type { VideoInfo } from './types'

interface InfoResult {
  ok: true
  info: VideoInfo
}
interface ErrorResult {
  ok: false
  error: string
}
type Result = InfoResult | ErrorResult

function presetToOptions(p: DownloadPreset): DownloadOptionsValue {
  return {
    height: p.height,
    format: p.format,
    vcodec: p.vcodec,
    audioOnly: p.audioOnly,
    audioFormat: p.audioFormat,
    subtitles: p.subtitles,
    subFormat: p.subFormat ?? 'srt',
    embedSubtitles: p.embedSubtitles,
    trimEnabled: false,
    trimStart: { h: 0, m: 0, s: 0, ms: 0 },
    trimEnd: { h: 0, m: 0, s: 0, ms: 0 }
  }
}

function App(): React.JSX.Element {
  useDownloadEvents()
  const loadSettings = useSettingsStore((s) => s.load)
  const settings = useSettingsStore((s) => s.settings)
  const loadPresets = usePresetsStore((s) => s.load)
  const presets = usePresetsStore((s) => s.presets)
  const activePresetId = usePresetsStore((s) => s.activeId)
  const queueEmpty = useDownloadStore((s) => s.items.length === 0)
  const { start, startBatch } = useStartDownload()

  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [options, setOptions] = useState<DownloadOptionsValue | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const initAppUpdate = useAppUpdateStore((s) => s.init)
  const checkAppUpdate = useAppUpdateStore((s) => s.check)
  const currentVersion = useAppUpdateStore((s) => s.currentVersion)
  const updateSettings = useSettingsStore((s) => s.update)

  const [whatsNew, setWhatsNew] = useState<ReleaseNotesEntry | null>(null)

  // 클립보드 자동 붙여넣기를 위해 최신 상태를 ref로 추적 (focus 핸들러 closure 용)
  const autoPasteStateRef = useRef({
    enabled: true,
    url: '',
    hasInfo: false,
    loading: false,
    lastPasted: ''
  })
  autoPasteStateRef.current = {
    enabled: settings?.autoPasteClipboard ?? true,
    url,
    hasInfo: info !== null,
    loading,
    lastPasted: autoPasteStateRef.current.lastPasted
  }

  useEffect(() => {
    loadSettings()
    loadPresets()
    initAppUpdate()
    void checkAppUpdate(true)
  }, [loadSettings, loadPresets, initAppUpdate, checkAppUpdate])

  useEffect(() => {
    // 윈도우 포커스 시 클립보드의 URL을 입력창에 자동 붙여넣기.
    // 입력창이 비어있고, 결과/로딩이 없을 때만 동작. 같은 URL은 두 번 안 붙임.
    const onFocus = async (): Promise<void> => {
      const s = autoPasteStateRef.current
      if (!s.enabled || s.url || s.hasInfo || s.loading) return
      try {
        const text = (await window.api.readClipboardText()).trim()
        if (!text || text === s.lastPasted) return
        if (!/^https?:\/\/\S+$/i.test(text)) return
        autoPasteStateRef.current.lastPasted = text
        setUrl(text)
      } catch {
        // 무시
      }
    }
    window.addEventListener('focus', onFocus)
    // 첫 마운트에서 이미 포커스 상태인 경우도 한 번 실행
    void onFocus()
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!settings || !currentVersion) return
    // 새 버전으로 부팅했고 사용자가 아직 못 본 변경사항이 있으면 표시.
    if (
      settings.lastReleaseNotes &&
      settings.lastReleaseNotes.version === currentVersion &&
      settings.lastSeenVersion !== currentVersion
    ) {
      setWhatsNew(settings.lastReleaseNotes)
    } else if (settings.lastSeenVersion === null) {
      // 최초 설치자 — 토스트 없이 현재 버전을 마지막으로 본 버전으로 기록.
      void updateSettings({ lastSeenVersion: currentVersion })
    }
  }, [settings, currentVersion, updateSettings])

  const dismissWhatsNew = (): void => {
    setWhatsNew(null)
    if (currentVersion) {
      void updateSettings({ lastSeenVersion: currentVersion })
    }
  }

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? null,
    [presets, activePresetId]
  )

  const entries = info?.entries ?? []

  const resetAll = (): void => {
    setInfo(null)
    setOptions(null)
    setSelected(new Set())
    setUrl('')
  }

  const handleFetch = async (): Promise<void> => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setInfo(null)
    setOptions(null)
    setSelected(new Set())
    try {
      const res = (await window.api.fetchVideoInfo(url.trim())) as Result
      if (!res.ok) {
        setError(res.error)
        return
      }

      const fetched = res.info

      if (activePreset && !fetched.isPlaylist) {
        const opts = presetToOptions(activePreset)
        await start(fetched, opts)
        resetAll()
        return
      }
      if (activePreset && fetched.isPlaylist) {
        const opts = presetToOptions(activePreset)
        const allEntries = fetched.entries ?? []
        await startBatch(
          allEntries.map((e) => ({
            id: e.id,
            url: e.url,
            title: e.title,
            platform: fetched.platform,
            thumbnail: e.thumbnail ?? fetched.thumbnail,
            options: opts
          }))
        )
        resetAll()
        return
      }

      setInfo(fetched)
      if (fetched.isPlaylist) {
        setOptions(defaultPlaylistOptions())
        setSelected(new Set(fetched.entries?.map((e) => e.id) ?? []))
      } else {
        setOptions(defaultOptions(fetched, settings))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleStartSingle = async (): Promise<void> => {
    if (!info || !options) return
    await start(info, options)
    resetAll()
  }

  const handleStartPlaylist = async (): Promise<void> => {
    if (!info || !options) return
    const chosen = entries.filter((e) => selected.has(e.id))
    if (chosen.length === 0) return
    await startBatch(
      chosen.map((e) => ({
        id: e.id,
        url: e.url,
        title: e.title,
        platform: info.platform,
        thumbnail: e.thumbnail ?? info.thumbnail,
        options
      }))
    )
    resetAll()
  }

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = (): void => setSelected(new Set(entries.map((e) => e.id)))
  const selectNone = (): void => setSelected(new Set())

  const selectedCount = selected.size

  const openDownloadsFolder = async (): Promise<void> => {
    if (!settings?.baseDir) return
    await window.api.openPath(settings.baseDir)
  }

  return (
    <div className="h-full overflow-auto" style={{ scrollbarGutter: 'stable' }}>
      <div className="titlebar-drag sticky top-0 z-30 h-10 backdrop-blur-md bg-[color:var(--color-ghost-bg)]/70 border-b border-[color:var(--color-ghost-border)]/60 flex items-center justify-end pr-3">
        <UpdatePill />
      </div>
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 pt-3 sm:pt-4 pb-10 sm:pb-12 space-y-5 sm:space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`${queueEmpty ? '' : 'ghost-float'} shrink-0`}>
              <Ghost size={44} withBadge sleeping={queueEmpty} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold text-[color:var(--color-ghost-text)] tracking-tight">
                  Dovvn
                </h1>
                {currentVersion && (
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-semibold tracking-tight text-[color:var(--color-ghost-accent-hover)] bg-[color:var(--color-ghost-accent-soft)] border border-[color:var(--color-ghost-border)]">
                    v{currentVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-[color:var(--color-ghost-muted)] truncate">
                유령이 영상 몰래 훔쳐다 주는 다운로더
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openDownloadsFolder}
              disabled={!settings?.baseDir}
              className="btn-icon lift"
              title={
                settings?.baseDir ? `다운로드 폴더 열기 (${settings.baseDir})` : '설정 로드 중'
              }
            >
              <FolderOpen size={18} />
            </button>
            <button onClick={() => setSettingsOpen(true)} className="btn-icon lift" title="설정">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <PresetBar />

        <UrlInput value={url} loading={loading} onChange={setUrl} onSubmit={handleFetch} />

        {activePreset && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[color:var(--color-ghost-accent-soft)] border border-[color:var(--color-ghost-border)] text-xs text-[color:var(--color-ghost-accent-hover)]">
            <Sparkles size={14} />
            <span>
              Smart Mode 활성{' '}
              <strong className="font-semibold">&ldquo;{activePreset.name}&rdquo;</strong> — URL
              붙이면 바로 다운로드 시작돼요
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <strong className="font-semibold">문제가 생겼어요</strong>
              <div className="mt-0.5 break-words">{error}</div>
            </div>
          </div>
        )}

        {info && !info.isPlaylist && (
          <div className="card overflow-hidden">
            <VideoInfoCard info={info} />
            {options && (
              <DownloadOptionsPanel
                info={info}
                value={options}
                onChange={setOptions}
                onSubmit={handleStartSingle}
              />
            )}
          </div>
        )}

        {info && info.isPlaylist && (
          <div className="card overflow-hidden">
            <PlaylistSelector
              info={info}
              selected={selected}
              onToggle={toggle}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
            />
            {options && (
              <PlaylistOptionsPanel
                value={options}
                onChange={setOptions}
                selectedCount={selectedCount}
                disabled={selectedCount === 0}
                onSubmit={handleStartPlaylist}
              />
            )}
          </div>
        )}

        <section>
          <h2 className="text-xs font-semibold text-[color:var(--color-ghost-muted)] uppercase tracking-wider mb-3 px-1">
            다운로드 큐
          </h2>
          <DownloadQueue />
        </section>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {whatsNew && <WhatsNewToast entry={whatsNew} onDismiss={dismissWhatsNew} />}
    </div>
  )
}

export default App
