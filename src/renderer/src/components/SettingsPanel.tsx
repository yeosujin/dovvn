import { useEffect, useState } from 'react'
import { RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { usePresetsStore } from '../stores/presetsStore'
import type { AppSettings, DownloadPreset, VideoCodec } from '../../../preload/index'
import { CODEC_LABEL } from './DownloadOptions'
import { Ghost } from './Ghost'
import { Select, type SelectOption } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { nativeLangLabel } from '../lib/lang'
import { extractBullets } from '../lib/releaseNotes'

interface Props {
  open: boolean
  onClose: () => void
}

// 0 = 원본 최상
const HEIGHT_OPTS: SelectOption<number>[] = [
  { value: 4320, label: '4320p · 7680×4320 (8K) 이하' },
  { value: 2160, label: '2160p · 3840×2160 (4K) 이하' },
  { value: 1440, label: '1440p · 2560×1440 (2K) 이하' },
  { value: 1080, label: '1080p · 1920×1080 (FHD) 이하' },
  { value: 720, label: '720p · 1280×720 (HD) 이하' },
  { value: 480, label: '480p · 854×480 이하' },
  { value: 360, label: '360p · 640×360 이하' },
  { value: 240, label: '240p · 426×240 이하' },
  { value: 144, label: '144p · 256×144 이하' },
  { value: 0, label: '원본 최상' }
]

const FORMAT_OPTS: SelectOption<'mp4' | 'mkv' | 'webm'>[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WebM' }
]

const AUDIO_FORMAT_OPTS: SelectOption<'mp3' | 'm4a' | 'wav'>[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' }
]

const CONCURRENT_OPTS: SelectOption<number>[] = [1, 2, 3, 4, 5].map((n) => ({
  value: n,
  label: `${n}`
}))

const VCODEC_OPTS: SelectOption<VideoCodec>[] = (Object.keys(CODEC_LABEL) as VideoCodec[]).map(
  (c) => ({ value: c, label: CODEC_LABEL[c] })
)

const SUB_FORMAT_OPTS: SelectOption<'srt' | 'vtt'>[] = [
  { value: 'srt', label: 'SRT', hint: '범용 호환' },
  { value: 'vtt', label: 'VTT', hint: '웹 표준' }
]

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-[color:var(--color-ghost-accent-hover)] uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-sm">
      <div className="sm:w-32 sm:shrink-0 text-xs sm:text-sm text-[color:var(--color-ghost-muted)]">
        {label}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}

export function SettingsPanel({ open, onClose }: Props): React.JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const pickBaseDir = useSettingsStore((s) => s.pickBaseDir)
  const presets = usePresetsStore((s) => s.presets)
  const savePreset = usePresetsStore((s) => s.save)
  const deletePreset = usePresetsStore((s) => s.remove)

  const [version, setVersion] = useState<string | null>(null)
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)
  const [updateLog, setUpdateLog] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [clearingCache, setClearingCache] = useState(false)
  const [cacheMsg, setCacheMsg] = useState<string | null>(null)

  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [appUpdateState, setAppUpdateState] = useState<
    'idle' | 'checking' | 'downloaded'
  >('idle')
  const [appUpdateMsg, setAppUpdateMsg] = useState<string | null>(null)

  const loadVersion = (): void => {
    setVersionLoading(true)
    setVersionError(null)
    window.api.ytdlpVersion().then((r) => {
      setVersionLoading(false)
      if (r.ok) {
        setVersion(r.version)
      } else {
        setVersion(null)
        setVersionError(r.error)
      }
    })
  }

  useEffect(() => {
    if (!open) return
    loadVersion()
    window.api.appVersion().then(setAppVersion)
  }, [open])

  useEffect(() => {
    const unsubs = [
      window.api.onAppUpdateChecking(() => {
        setAppUpdateState('checking')
        setAppUpdateMsg(null)
      }),
      window.api.onAppUpdateNotAvailable(() => {
        setAppUpdateState('idle')
        setAppUpdateMsg('이미 최신 버전입니다')
      }),
      window.api.onAppUpdateError((msg) => {
        setAppUpdateState('idle')
        setAppUpdateMsg(`업데이트 실패: ${msg}`)
      }),
      window.api.onAppUpdateDownloaded((info) => {
        setAppUpdateState('downloaded')
        setAppUpdateMsg(`버전 ${info.version} 설치 준비 완료`)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    if (!updating) return
    const unsubscribe = window.api.onUpdaterLog((line) => setUpdateLog(line))
    return unsubscribe
  }, [updating])

  if (!open || !settings) return null

  const setField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    update({ [key]: value } as Partial<AppSettings>)
  }

  const doAppUpdate = async (): Promise<void> => {
    if (appUpdateState === 'downloaded') {
      window.api.appUpdateQuitAndInstall()
      return
    }
    setAppUpdateState('checking')
    setAppUpdateMsg(null)
    const r = await window.api.appUpdateCheck()
    if (!r.ok) {
      setAppUpdateState('idle')
      setAppUpdateMsg(`업데이트 확인 실패: ${r.error}`)
      return
    }
    if (!r.version || r.version === appVersion) {
      setAppUpdateState('idle')
      setAppUpdateMsg('이미 최신 버전입니다')
    }
    // 새 버전이 있으면 main의 autoDownload가 백그라운드로 받음.
    // 'checking' 상태로 두고 onAppUpdateDownloaded 이벤트를 기다림.
  }

  const doUpdate = async (): Promise<void> => {
    setUpdating(true)
    setUpdateMsg(null)
    setUpdateLog(null)
    const r = await window.api.ytdlpUpdate()
    setUpdating(false)
    setUpdateLog(null)
    if (r.ok) {
      if (r.afterVersion !== '?') setVersion(r.afterVersion)
      const b = r.beforeVersion
      const a = r.afterVersion
      setUpdateMsg(
        a === '?'
          ? '업데이트 완료 (버전 확인 실패)'
          : b === a
            ? `이미 최신 버전입니다 (${a})`
            : `${b} → ${a} 업데이트 완료`
      )
    } else {
      setUpdateMsg(`업데이트 실패: ${r.error}`)
    }
  }

  const saveCurrentAsPreset = async (): Promise<void> => {
    if (!presetName.trim()) return
    const preset: DownloadPreset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      height: settings.defaultHeight,
      format: settings.defaultFormat,
      vcodec: settings.defaultVcodec,
      audioOnly: settings.defaultAudioOnly,
      audioFormat: settings.defaultAudioFormat,
      subtitles: settings.defaultSubtitles,
      subFormat: settings.defaultSubFormat,
      embedSubtitles: settings.defaultEmbedSubtitles,
      createdAt: Date.now()
    }
    await savePreset(preset)
    setPresetName('')
  }

  const doClearCache = async (): Promise<void> => {
    setClearingCache(true)
    setCacheMsg(null)
    const r = await window.api.clearCache()
    setClearingCache(false)
    setCacheMsg(r.ok ? '캐시 삭제 완료' : `캐시 삭제 실패: ${r.error}`)
  }

  const toggleSubtitle = (lang: string): void => {
    const has = settings.defaultSubtitles.includes(lang)
    const next = has
      ? settings.defaultSubtitles.filter((l) => l !== lang)
      : [...settings.defaultSubtitles, lang]
    setField('defaultSubtitles', next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(45,42,61,0.4)] backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-hidden bg-white rounded-[20px] sm:rounded-[24px] border border-[color:var(--color-ghost-border)] shadow-[0_24px_60px_-20px_rgba(124,106,232,0.4)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 px-4 sm:px-6 py-4 border-b border-[color:var(--color-ghost-border)] flex items-center justify-between bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <Ghost size={28} expression="curious" />
            <h2 className="text-lg font-bold text-[color:var(--color-ghost-text)]">설정</h2>
          </div>
          <button onClick={onClose} className="btn-icon" title="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="p-4 sm:p-6 space-y-6 overflow-auto">
          <Section title="일반">
            <Row label="저장 위치">
              <span
                className="font-mono text-xs text-[color:var(--color-ghost-text)] truncate flex-1 bg-[color:var(--color-ghost-accent-soft)]/50 px-2.5 py-1.5 rounded-lg"
                title={settings.baseDir}
              >
                {settings.baseDir}
              </span>
              <button onClick={pickBaseDir} className="btn-soft text-xs px-3 py-1.5">
                변경
              </button>
            </Row>
            <Row label="플랫폼별 하위 폴더">
              <Checkbox
                checked={settings.usePlatformSubfolder}
                onChange={(v) => setField('usePlatformSubfolder', v)}
                label="YouTube, Vimeo 등 플랫폼별로 폴더 분리"
              />
            </Row>
            <Row label="동시 다운로드">
              <Select<number>
                value={settings.maxConcurrent}
                options={CONCURRENT_OPTS}
                onChange={(v) => setField('maxConcurrent', v)}
                className="w-24"
              />
            </Row>
            <Row label="완료 시 알림">
              <Checkbox
                checked={settings.completionNotify}
                onChange={(v) => setField('completionNotify', v)}
              />
            </Row>
            <Row label="자동 붙여넣기">
              <Checkbox
                checked={settings.autoPasteClipboard}
                onChange={(v) => setField('autoPasteClipboard', v)}
                label="앱 켤 때 클립보드에 있는 링크를 자동으로 채워줍니다"
              />
            </Row>
          </Section>

          <Section title="기본 다운로드 옵션">
            <Row label="타입">
              <div className="inline-flex p-1 rounded-xl bg-[color:var(--color-ghost-accent-soft)]">
                <button
                  onClick={() => setField('defaultAudioOnly', false)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    !settings.defaultAudioOnly
                      ? 'bg-white text-[color:var(--color-ghost-accent-hover)] shadow-sm'
                      : 'text-[color:var(--color-ghost-muted)]'
                  }`}
                >
                  영상
                </button>
                <button
                  onClick={() => setField('defaultAudioOnly', true)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    settings.defaultAudioOnly
                      ? 'bg-white text-[color:var(--color-ghost-accent-hover)] shadow-sm'
                      : 'text-[color:var(--color-ghost-muted)]'
                  }`}
                >
                  음성만
                </button>
              </div>
            </Row>
            {!settings.defaultAudioOnly && (
              <>
                <Row label="기본 해상도">
                  <Select<number>
                    value={settings.defaultHeight ?? 0}
                    options={HEIGHT_OPTS}
                    onChange={(v) => setField('defaultHeight', v === 0 ? null : v)}
                    className="flex-1 max-w-sm"
                  />
                </Row>
                <Row label="기본 포맷">
                  <Select
                    value={settings.defaultFormat}
                    options={FORMAT_OPTS}
                    onChange={(v) => setField('defaultFormat', v)}
                    className="w-32"
                  />
                </Row>
                <Row label="기본 코덱">
                  <Select
                    value={settings.defaultVcodec}
                    options={VCODEC_OPTS}
                    onChange={(v) => setField('defaultVcodec', v)}
                    className="flex-1 max-w-xs"
                  />
                </Row>
                <Row label="기본 자막">
                  {['ko', 'en', 'ja'].map((lang) => {
                    const checked = settings.defaultSubtitles.includes(lang)
                    return (
                      <button
                        key={lang}
                        onClick={() => toggleSubtitle(lang)}
                        className={`chip text-[11px] ${checked ? 'chip-active' : ''}`}
                      >
                        {nativeLangLabel(lang)}
                      </button>
                    )
                  })}
                  <Checkbox
                    checked={settings.defaultEmbedSubtitles}
                    onChange={(v) => setField('defaultEmbedSubtitles', v)}
                    label="임베드"
                    size="sm"
                    className="ml-2"
                  />
                </Row>
                <Row label="자막 포맷">
                  <Select<'srt' | 'vtt'>
                    value={settings.defaultSubFormat}
                    options={SUB_FORMAT_OPTS}
                    onChange={(v) => setField('defaultSubFormat', v)}
                    className="w-40"
                  />
                </Row>
              </>
            )}
            {settings.defaultAudioOnly && (
              <Row label="기본 음성 포맷">
                <Select
                  value={settings.defaultAudioFormat}
                  options={AUDIO_FORMAT_OPTS}
                  onChange={(v) => setField('defaultAudioFormat', v)}
                  className="w-32"
                />
              </Row>
            )}
          </Section>

          <Section title="Smart Mode 프리셋">
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="현재 기본 옵션을 프리셋으로 저장 (이름)"
                className="flex-1 px-3 py-2 bg-white border border-[color:var(--color-ghost-border)] rounded-lg text-sm focus:border-[#b9adf0] focus:ring-2 focus:ring-[rgba(124,106,232,0.14)] outline-none transition"
              />
              <button
                onClick={saveCurrentAsPreset}
                disabled={!presetName.trim()}
                className="btn-primary text-sm"
                style={{ padding: '8px 14px', borderRadius: '12px' }}
              >
                <Save size={14} />
                저장
              </button>
            </div>
            {presets.length === 0 ? (
              <div className="text-xs text-[color:var(--color-ghost-muted)] italic px-1">
                저장된 프리셋이 없습니다
              </div>
            ) : (
              <ul className="space-y-1.5">
                {presets.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 text-sm px-3 py-2 bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)] rounded-xl"
                  >
                    <span className="font-medium text-[color:var(--color-ghost-text)]">
                      {p.name}
                    </span>
                    <span className="flex-1 text-xs text-[color:var(--color-ghost-muted)] truncate">
                      {p.audioOnly
                        ? `${p.audioFormat.toUpperCase()} 음성`
                        : `${p.height ? `${p.height}p 이하` : '최상'} · ${p.format.toUpperCase()}${
                            p.vcodec && p.vcodec !== 'auto' ? ` · ${p.vcodec.toUpperCase()}` : ''
                          }`}
                      {p.subtitles.length > 0 ? ` · 자막 ${p.subtitles.join('/')}` : ''}
                    </span>
                    <button
                      onClick={() => deletePreset(p.id)}
                      className="p-1.5 text-[color:var(--color-ghost-muted)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Dovvn">
            <Row label="현재 버전">
              <span className="font-mono text-xs text-[color:var(--color-ghost-text)] bg-[color:var(--color-ghost-accent-soft)]/50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                {appVersion ?? '-'}
              </span>
              <button
                onClick={doAppUpdate}
                disabled={appUpdateState === 'checking'}
                className="btn-soft text-xs px-3 py-1.5"
              >
                <RefreshCw
                  size={12}
                  className={appUpdateState === 'checking' ? 'animate-spin' : ''}
                />
                {appUpdateState === 'checking'
                  ? '확인 중'
                  : appUpdateState === 'downloaded'
                    ? '재시작하여 설치'
                    : '업데이트 확인'}
              </button>
              {appUpdateMsg && (
                <span className="text-xs text-[color:var(--color-ghost-muted)] truncate">
                  {appUpdateMsg}
                </span>
              )}
            </Row>
            <ReleaseNotesRow entry={settings.lastReleaseNotes} />
          </Section>

          <Section title="yt-dlp">
            <Row label="현재 버전">
              <span className="font-mono text-xs text-[color:var(--color-ghost-text)] bg-[color:var(--color-ghost-accent-soft)]/50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                {versionLoading && <RefreshCw size={10} className="animate-spin" />}
                {versionLoading ? '불러오는 중…' : (version ?? (versionError ? '확인 실패' : '-'))}
              </span>
              {versionError && !versionLoading && (
                <button onClick={loadVersion} className="btn-soft text-xs px-2.5 py-1">
                  <RefreshCw size={12} />
                  다시 시도
                </button>
              )}
              <button
                onClick={doUpdate}
                disabled={updating || versionLoading}
                className="btn-soft text-xs px-3 py-1.5"
              >
                <RefreshCw size={12} className={updating ? 'animate-spin' : ''} />
                {updating ? '확인 중' : '업데이트 확인'}
              </button>
              {updating && updateLog && (
                <span className="text-xs text-[color:var(--color-ghost-muted)] truncate font-mono">
                  {updateLog}
                </span>
              )}
              {!updating && updateMsg && (
                <span className="text-xs text-[color:var(--color-ghost-muted)] truncate">
                  {updateMsg}
                </span>
              )}
            </Row>
          </Section>

          <Section title="저장 공간">
            <Row label="캐시 삭제">
              <button
                onClick={doClearCache}
                disabled={clearingCache}
                className="btn-soft text-xs px-3 py-1.5"
              >
                <Trash2 size={12} className={clearingCache ? 'animate-pulse' : ''} />
                {clearingCache ? '삭제 중…' : '앱·yt-dlp 캐시 삭제'}
              </button>
              {cacheMsg && (
                <span className="text-xs text-[color:var(--color-ghost-muted)] truncate whitespace-pre-wrap">
                  {cacheMsg}
                </span>
              )}
            </Row>
            <div className="text-xs text-[color:var(--color-ghost-muted)] sm:pl-[calc(8rem+0.75rem)]">
              썸네일/임시 캐시만 지우며 다운로드한 파일과 기록은 유지됩니다
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function ReleaseNotesRow({
  entry
}: {
  entry: import('../../../preload/index').ReleaseNotesEntry | null
}): React.JSX.Element | null {
  if (!entry) return null
  const bullets = extractBullets(entry.notes)
  if (bullets.length === 0) return null
  return (
    <Row label="이번 변경사항">
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] text-[color:var(--color-ghost-muted)] mb-1 tabular-nums">
          v{entry.version}에서 추가됨
        </div>
        <ul className="space-y-1">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="text-xs text-[color:var(--color-ghost-text)] leading-snug flex gap-1.5"
            >
              <span className="text-[color:var(--color-ghost-accent)] shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </Row>
  )
}
