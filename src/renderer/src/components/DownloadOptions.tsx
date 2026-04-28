import { useRef, useState } from 'react'
import { ChevronDown, Download, Film, Music2, Scissors } from 'lucide-react'
import type { AppSettings, SubtitleFormat } from '../../../preload/index'
import type { VideoInfo } from '../types'
import { Select, type SelectOption } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { nativeLangLabel, sortLangs, dedupeLangsByLabel } from '../lib/lang'

export type VideoCodec = 'auto' | 'h264' | 'vp9' | 'av1'

export interface TimeMark {
  h: number
  m: number
  s: number
  ms: number
}

export const ZERO_TIME: TimeMark = { h: 0, m: 0, s: 0, ms: 0 }

export function timeMarkToSeconds(t: TimeMark): number {
  return t.h * 3600 + t.m * 60 + t.s + t.ms / 1000
}

export function secondsToTimeMark(seconds: number): TimeMark {
  const total = Math.max(0, seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  const ms = Math.round((total - Math.floor(total)) * 1000)
  return { h, m, s, ms }
}

const SUB_FORMAT_OPTIONS: SelectOption<SubtitleFormat>[] = [
  { value: 'srt', label: 'SRT', hint: '범용' },
  { value: 'vtt', label: 'VTT', hint: '웹 표준' }
]

export const CODEC_LABEL: Record<VideoCodec, string> = {
  auto: '자동',
  h264: 'H.264 (호환성)',
  vp9: 'VP9',
  av1: 'AV1 (고효율)'
}

export interface DownloadOptionsValue {
  filename?: string
  height: number | null
  format: 'mp4' | 'mkv' | 'webm'
  vcodec: VideoCodec
  audioOnly: boolean
  audioFormat: 'mp3' | 'm4a' | 'wav'
  subtitles: string[]
  subFormat: SubtitleFormat
  embedSubtitles: boolean
  trimEnabled: boolean
  trimStart: TimeMark
  trimEnd: TimeMark
}

function pickHeight(info: VideoInfo, preferred: number | null): number | null {
  const shorts = (info.availableResolutions ?? []).map((r) => r.short)
  if (shorts.length === 0) return preferred
  if (preferred === null) return shorts[0]
  const supported = shorts.find((h) => h <= preferred)
  return supported ?? shorts[0]
}

export const defaultOptions = (
  info: VideoInfo,
  settings?: AppSettings | null
): DownloadOptionsValue => {
  const subsFromSettings = settings?.defaultSubtitles ?? []
  const allAvailable = [...info.subtitles, ...(info.autoSubtitles ?? [])]
  const availableSubs = subsFromSettings.filter((lang) => allAvailable.includes(lang))
  return {
    filename: '',
    height: pickHeight(info, settings?.defaultHeight ?? null),
    format: settings?.defaultFormat ?? 'mp4',
    vcodec: settings?.defaultVcodec ?? 'auto',
    audioOnly: settings?.defaultAudioOnly ?? false,
    audioFormat: settings?.defaultAudioFormat ?? 'mp3',
    subtitles: availableSubs,
    subFormat: settings?.defaultSubFormat ?? 'srt',
    embedSubtitles: settings?.defaultEmbedSubtitles ?? false,
    trimEnabled: false,
    trimStart: { ...ZERO_TIME },
    trimEnd: info.duration ? secondsToTimeMark(info.duration) : { ...ZERO_TIME }
  }
}

interface Props {
  info: VideoInfo
  value: DownloadOptionsValue
  onChange: (v: DownloadOptionsValue) => void
  onSubmit: () => void
}

export function DownloadOptionsPanel({
  info,
  value,
  onChange,
  onSubmit
}: Props): React.JSX.Element {
  const setField = <K extends keyof DownloadOptionsValue>(
    key: K,
    v: DownloadOptionsValue[K]
  ): void => onChange({ ...value, [key]: v })

  const toggleSubtitle = (lang: string): void => {
    const next = value.subtitles.includes(lang)
      ? value.subtitles.filter((l) => l !== lang)
      : [...value.subtitles, lang]
    setField('subtitles', next)
  }

  const originalLangs = sortLangs(dedupeLangsByLabel(info.subtitles))
  const autoLangs = sortLangs(dedupeLangsByLabel(info.autoSubtitles ?? []))
  const hasAnySubs = originalLangs.length > 0 || autoLangs.length > 0

  const resolutions = info.availableResolutions ?? []
  const heightOptions: SelectOption<number>[] = resolutions.length
    ? resolutions.map((r) => ({
        value: r.short,
        label: `${r.short}p`,
        hint: `${r.width}×${r.height}`
      }))
    : [{ value: 0, label: '최상' }]
  const heightValue = value.height ?? (resolutions.length === 0 ? 0 : resolutions[0].short)

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
        <Row label="파일명">
          <input
            type="text"
            value={value.filename ?? ''}
            onChange={(e) => setField('filename', e.target.value)}
            placeholder={info.title}
            className="w-full px-3 py-2 text-[13px] rounded-[10px] bg-white border border-[color:var(--color-ghost-border)] text-[color:var(--color-ghost-text)] placeholder:text-[color:var(--color-ghost-muted)] outline-none transition hover:border-[#d9d2f5] focus:border-[#b9adf0] focus:ring-[4px] focus:ring-[rgba(124,106,232,0.14)]"
          />
        </Row>

        <Row label="타입">
          <TypeToggle audioOnly={value.audioOnly} onChange={(v) => setField('audioOnly', v)} />
        </Row>

        {!value.audioOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="해상도">
              <Select<number>
                value={heightValue}
                options={heightOptions}
                onChange={(v) => setField('height', v === 0 ? null : v)}
                disabled={resolutions.length === 0}
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

        {!value.audioOnly && (
          <Row label="구간">
            <TrimRangePicker
              duration={info.duration}
              enabled={value.trimEnabled}
              start={value.trimStart}
              end={value.trimEnd}
              onToggle={(v) => setField('trimEnabled', v)}
              onChangeStart={(v) => setField('trimStart', v)}
              onChangeEnd={(v) => setField('trimEnd', v)}
            />
          </Row>
        )}

        {hasAnySubs && !value.audioOnly && (
          <Row label="자막">
            <SubtitlePicker
              originalLangs={originalLangs}
              autoLangs={autoLangs}
              selected={value.subtitles}
              subFormat={value.subFormat}
              embed={value.embedSubtitles}
              onToggleLang={toggleSubtitle}
              onChangeFormat={(v) => setField('subFormat', v)}
              onChangeEmbed={(v) => setField('embedSubtitles', v)}
            />
          </Row>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[color:var(--color-ghost-border)] bg-[color:var(--color-ghost-accent-soft)]/25 flex justify-end">
        <button onClick={onSubmit} className="btn-primary lift">
          <Download size={15} />
          다운로드
        </button>
      </div>
    </div>
  )
}

// 주요 언어 + 선택된 것만 기본 노출, 나머지는 "더 보기"로 확장
const PRIMARY_VISIBLE = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'zh']

function SubtitleChipRow({
  langs,
  selected,
  onToggleLang,
  collapsible
}: {
  langs: string[]
  selected: string[]
  onToggleLang: (lang: string) => void
  collapsible: boolean
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const visibleLangs =
    !collapsible || expanded
      ? langs
      : langs.filter((l) => PRIMARY_VISIBLE.includes(l) || selected.includes(l))
  const hiddenCount = langs.length - visibleLangs.length

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visibleLangs.map((lang) => {
        const checked = selected.includes(lang)
        return (
          <button
            key={lang}
            onClick={() => onToggleLang(lang)}
            title={lang}
            className={`chip text-[11px] px-2.5 py-1 ${checked ? 'chip-active' : ''}`}
          >
            {nativeLangLabel(lang)}
          </button>
        )
      })}
      {collapsible && hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-accent-hover)] px-2 py-1 transition"
        >
          +{hiddenCount}개 언어
        </button>
      )}
      {collapsible && expanded && langs.some((l) => !PRIMARY_VISIBLE.includes(l)) && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[11px] text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-accent-hover)] px-2 py-1 transition"
        >
          접기
        </button>
      )}
    </div>
  )
}

function SubtitlePicker({
  originalLangs,
  autoLangs,
  selected,
  subFormat,
  embed,
  onToggleLang,
  onChangeFormat,
  onChangeEmbed
}: {
  originalLangs: string[]
  autoLangs: string[]
  selected: string[]
  subFormat: SubtitleFormat
  embed: boolean
  onToggleLang: (lang: string) => void
  onChangeFormat: (v: SubtitleFormat) => void
  onChangeEmbed: (v: boolean) => void
}): React.JSX.Element {
  const [autoOpen, setAutoOpen] = useState(false)
  const selectedAutoCount = selected.filter((l) => autoLangs.includes(l)).length

  return (
    <div className="space-y-3">
      {originalLangs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-medium text-[color:var(--color-ghost-muted)] uppercase tracking-wider">
            원본 자막
          </div>
          <SubtitleChipRow
            langs={originalLangs}
            selected={selected}
            onToggleLang={onToggleLang}
            collapsible={false}
          />
        </div>
      )}

      {autoLangs.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setAutoOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[color:var(--color-ghost-muted)] uppercase tracking-wider hover:text-[color:var(--color-ghost-accent-hover)] transition"
          >
            <ChevronDown size={11} className={autoOpen ? '' : '-rotate-90'} />
            자동 번역 자막
            <span className="normal-case tracking-normal font-normal">
              ({autoLangs.length}개{selectedAutoCount > 0 ? `, ${selectedAutoCount}개 선택됨` : ''})
            </span>
          </button>
          {autoOpen && (
            <SubtitleChipRow
              langs={autoLangs}
              selected={selected}
              onToggleLang={onToggleLang}
              collapsible={false}
            />
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-[color:var(--color-ghost-muted)]">포맷</span>
            <Select<SubtitleFormat>
              value={subFormat}
              options={SUB_FORMAT_OPTIONS}
              onChange={onChangeFormat}
              size="sm"
              className="min-w-[110px]"
            />
          </div>
          <Checkbox checked={embed} onChange={onChangeEmbed} label="임베드" size="sm" />
        </div>
      )}
    </div>
  )
}

function TimeNumberInput({
  value,
  max,
  pad,
  onChange,
  inputRef,
  onArrowLeft,
  onArrowRight,
  onAdvance
}: {
  value: number
  max: number
  pad: number
  onChange: (v: number) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onAdvance?: () => void
}): React.JSX.Element {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string>(String(value).padStart(pad, '0'))

  // 포커스 밖일 때만 외부 value를 표시값으로 동기화 — 입력 중 강제 padStart로 백스페이스가 무력화되는 문제 방지.
  if (!focused) {
    const padded = String(value).padStart(pad, '0')
    if (padded !== draft) setDraft(padded)
  }

  const widthPx = pad === 2 ? 36 : 44
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={() => {
        setFocused(false)
        setDraft(String(value).padStart(pad, '0'))
      }}
      onKeyDown={(e) => {
        const el = e.currentTarget
        const caretAt = el.selectionStart === el.selectionEnd ? el.selectionStart : null
        if (e.key === 'ArrowRight' && caretAt === el.value.length) {
          e.preventDefault()
          onArrowRight?.()
        } else if (e.key === 'ArrowLeft' && caretAt === 0) {
          e.preventDefault()
          onArrowLeft?.()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const next = Math.min(max, value + step)
          if (next !== value) onChange(next)
          setDraft(String(next).padStart(pad, '0'))
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const next = Math.max(0, value - step)
          if (next !== value) onChange(next)
          setDraft(String(next).padStart(pad, '0'))
        }
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '')
        // 빈 입력 — 사용자가 통째로 지운 상태로 둠.
        if (raw === '') {
          setDraft('')
          if (value !== 0) onChange(0)
          return
        }
        // odometer 방식: 가장 최근 pad자리만 유지 → "00" + "2" = "02", "02" + "4" = "24".
        const last = raw.slice(-pad)
        const n = parseInt(last, 10)
        // max 초과 입력은 거부 (예: 분 60).
        if (n > max) return
        setDraft(last.padStart(pad, '0'))
        if (n !== value) onChange(n)
        // pad자리만큼 채워지면 다음 칸으로 자동 진행 — 쭉 타이핑 가능.
        if (raw.length >= pad) onAdvance?.()
      }}
      style={{ width: widthPx }}
      className="text-center px-0 py-1 text-[12px] tabular-nums rounded-md bg-white border border-[color:var(--color-ghost-border)] text-[color:var(--color-ghost-text)] outline-none transition hover:border-[#d9d2f5] focus:border-[#b9adf0] focus:ring-[3px] focus:ring-[rgba(124,106,232,0.14)]"
    />
  )
}

function TimeMarkInput({
  value,
  onChange
}: {
  value: TimeMark
  onChange: (v: TimeMark) => void
}): React.JSX.Element {
  const set = <K extends keyof TimeMark>(key: K, v: number): void =>
    onChange({ ...value, [key]: v })

  const hRef = useRef<HTMLInputElement>(null)
  const mRef = useRef<HTMLInputElement>(null)
  const sRef = useRef<HTMLInputElement>(null)
  const msRef = useRef<HTMLInputElement>(null)
  const focusEl = (el: HTMLInputElement | null): void => el?.focus()

  const colon = (
    <span className="text-[color:var(--color-ghost-muted)] text-[12px] select-none">:</span>
  )
  const dot = (
    <span className="text-[color:var(--color-ghost-muted)] text-[12px] select-none">.</span>
  )
  return (
    <div className="inline-flex items-center gap-1">
      <TimeNumberInput
        inputRef={hRef}
        value={value.h}
        max={99}
        pad={2}
        onChange={(v) => set('h', v)}
        onArrowRight={() => focusEl(mRef.current)}
        onAdvance={() => focusEl(mRef.current)}
      />
      {colon}
      <TimeNumberInput
        inputRef={mRef}
        value={value.m}
        max={59}
        pad={2}
        onChange={(v) => set('m', v)}
        onArrowLeft={() => focusEl(hRef.current)}
        onArrowRight={() => focusEl(sRef.current)}
        onAdvance={() => focusEl(sRef.current)}
      />
      {colon}
      <TimeNumberInput
        inputRef={sRef}
        value={value.s}
        max={59}
        pad={2}
        onChange={(v) => set('s', v)}
        onArrowLeft={() => focusEl(mRef.current)}
        onArrowRight={() => focusEl(msRef.current)}
        onAdvance={() => focusEl(msRef.current)}
      />
      {dot}
      <TimeNumberInput
        inputRef={msRef}
        value={value.ms}
        max={999}
        pad={3}
        onChange={(v) => set('ms', v)}
        onArrowLeft={() => focusEl(sRef.current)}
      />
    </div>
  )
}

function formatDuration(seconds: number): string {
  const t = secondsToTimeMark(seconds)
  const hh = String(t.h).padStart(2, '0')
  const mm = String(t.m).padStart(2, '0')
  const ss = String(t.s).padStart(2, '0')
  return t.h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

function TrimRangePicker({
  duration,
  enabled,
  start,
  end,
  onToggle,
  onChangeStart,
  onChangeEnd
}: {
  duration: number | null
  enabled: boolean
  start: TimeMark
  end: TimeMark
  onToggle: (v: boolean) => void
  onChangeStart: (v: TimeMark) => void
  onChangeEnd: (v: TimeMark) => void
}): React.JSX.Element {
  const startSec = timeMarkToSeconds(start)
  const endSec = timeMarkToSeconds(end)
  const overDuration = duration !== null && (startSec > duration || endSec > duration)
  const invalidOrder = enabled && endSec <= startSec
  const error = enabled && (overDuration || invalidOrder)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Checkbox
          checked={enabled}
          onChange={onToggle}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Scissors size={11} />
              구간만 저장
            </span>
          }
          size="sm"
        />
        {duration !== null && (
          <span className="text-[11px] text-[color:var(--color-ghost-muted)] tabular-nums">
            전체 길이 {formatDuration(duration)}
          </span>
        )}
      </div>

      {enabled && (
        <div className="space-y-1.5 pl-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] w-9 text-[color:var(--color-ghost-muted)]">시작</span>
            <TimeMarkInput value={start} onChange={onChangeStart} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] w-9 text-[color:var(--color-ghost-muted)]">끝</span>
            <TimeMarkInput value={end} onChange={onChangeEnd} />
          </div>
          <div className="text-[10.5px] text-[color:var(--color-ghost-muted)] tabular-nums pt-0.5">
            시 : 분 : 초 . ms
          </div>
          {error && (
            <div className="text-[11px] text-rose-500">
              {invalidOrder
                ? '끝 시간은 시작보다 뒤여야 합니다'
                : `영상 길이(${formatDuration(duration ?? 0)})를 넘을 수 없습니다`}
            </div>
          )}
        </div>
      )}
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
