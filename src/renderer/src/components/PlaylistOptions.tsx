import { Download, Film, Music2 } from 'lucide-react'
import type { DownloadOptionsValue, VideoCodec } from './DownloadOptions'
import { CODEC_LABEL } from './DownloadOptions'
import { Select, type SelectOption } from './ui/Select'

const HEIGHT_PRESETS: Array<{ value: number; label: string }> = [
  { value: 4320, label: '4320p · 7680×4320 (8K)' },
  { value: 2160, label: '2160p · 3840×2160 (4K)' },
  { value: 1440, label: '1440p · 2560×1440 (2K)' },
  { value: 1080, label: '1080p · 1920×1080 (FHD)' },
  { value: 720, label: '720p · 1280×720 (HD)' },
  { value: 480, label: '480p · 854×480' },
  { value: 360, label: '360p · 640×360' },
  { value: 240, label: '240p · 426×240' },
  { value: 144, label: '144p · 256×144' }
]

export const defaultPlaylistOptions = (): DownloadOptionsValue => ({
  height: 1080,
  format: 'mp4',
  vcodec: 'auto',
  audioOnly: false,
  audioFormat: 'mp3',
  subtitles: [],
  subFormat: 'srt',
  embedSubtitles: false,
  trimEnabled: false,
  trimStart: { h: 0, m: 0, s: 0, ms: 0 },
  trimEnd: { h: 0, m: 0, s: 0, ms: 0 }
})

interface Props {
  value: DownloadOptionsValue
  onChange: (v: DownloadOptionsValue) => void
  selectedCount: number
  disabled: boolean
  onSubmit: () => void
}

export function PlaylistOptionsPanel({
  value,
  onChange,
  selectedCount,
  disabled,
  onSubmit
}: Props): React.JSX.Element {
  const setField = <K extends keyof DownloadOptionsValue>(
    key: K,
    v: DownloadOptionsValue[K]
  ): void => onChange({ ...value, [key]: v })

  const heightOptions: SelectOption<number>[] = [
    ...HEIGHT_PRESETS.map((h) => ({ value: h.value, label: h.label })),
    { value: 0, label: '원본 최상' }
  ]
  const formatOptions: SelectOption<'mp4' | 'mkv' | 'webm'>[] = [
    { value: 'mp4', label: 'MP4' },
    { value: 'mkv', label: 'MKV' },
    { value: 'webm', label: 'WebM' }
  ]
  const vcodecOptions: SelectOption<VideoCodec>[] = (Object.keys(CODEC_LABEL) as VideoCodec[]).map(
    (c) => ({ value: c, label: CODEC_LABEL[c] })
  )
  const audioFormatOptions: SelectOption<'mp3' | 'm4a' | 'wav'>[] = [
    { value: 'mp3', label: 'MP3' },
    { value: 'm4a', label: 'M4A' },
    { value: 'wav', label: 'WAV' }
  ]

  return (
    <div className="border-t border-[color:var(--color-ghost-border)]">
      <div className="p-5 space-y-4">
        <Row label="타입">
          <TypeToggle audioOnly={value.audioOnly} onChange={(v) => setField('audioOnly', v)} />
        </Row>

        {!value.audioOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="최대 해상도">
              <Select<number>
                value={value.height ?? 0}
                options={heightOptions}
                onChange={(v) => setField('height', v === 0 ? null : v)}
              />
            </Field>
            <Field label="포맷">
              <Select
                value={value.format}
                options={formatOptions}
                onChange={(v) => setField('format', v)}
              />
            </Field>
            <Field label="코덱">
              <Select
                value={value.vcodec}
                options={vcodecOptions}
                onChange={(v) => setField('vcodec', v)}
              />
            </Field>
          </div>
        )}

        {value.audioOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="음성 포맷">
              <Select
                value={value.audioFormat}
                options={audioFormatOptions}
                onChange={(v) => setField('audioFormat', v)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[color:var(--color-ghost-border)] bg-[color:var(--color-ghost-accent-soft)]/25 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-[color:var(--color-ghost-muted)]">
          선택된 항목{' '}
          <strong className="text-[color:var(--color-ghost-accent-hover)]">{selectedCount}</strong>
          개
        </span>
        <button onClick={onSubmit} disabled={disabled} className="btn-primary lift">
          <Download size={15} />
          다운로드 ({selectedCount})
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <div className="sm:w-14 sm:shrink-0 text-xs font-medium text-[color:var(--color-ghost-muted)]">
        {label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[color:var(--color-ghost-muted)] px-0.5">
        {label}
      </span>
      {children}
    </label>
  )
}

function TypeToggle({
  audioOnly,
  onChange
}: {
  audioOnly: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <div className="inline-flex p-1 rounded-xl bg-[color:var(--color-ghost-accent-soft)]">
      <button
        onClick={() => onChange(false)}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition ${
          !audioOnly
            ? 'bg-white text-[color:var(--color-ghost-accent-hover)] shadow-sm'
            : 'text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-text)]'
        }`}
      >
        <Film size={12} />
        영상
      </button>
      <button
        onClick={() => onChange(true)}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition ${
          audioOnly
            ? 'bg-white text-[color:var(--color-ghost-accent-hover)] shadow-sm'
            : 'text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-text)]'
        }`}
      >
        <Music2 size={12} />
        음성만
      </button>
    </div>
  )
}
