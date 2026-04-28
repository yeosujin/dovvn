import { app } from 'electron'
import { ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { runYtDlp } from './runner'
import { PROGRESS_TEMPLATE, parseProgressLine, type ProgressUpdate } from './parser'

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled'

export type VideoCodec = 'auto' | 'h264' | 'vp9' | 'av1'

export type SubtitleFormat = 'srt' | 'vtt'

export interface DownloadOptions {
  id: string
  url: string
  outputDir: string
  filename?: string
  height?: number
  format?: 'mp4' | 'mkv' | 'webm'
  vcodec?: VideoCodec
  audioOnly?: boolean
  audioFormat?: 'mp3' | 'm4a' | 'wav'
  subtitles?: string[]
  subFormat?: SubtitleFormat
  embedSubtitles?: boolean
  /** ffmpeg 시간 문자열. 예: "00:01:30.500". 둘 다 있어야 적용. */
  trimStart?: string
  trimEnd?: string
}

// 사용자가 입력한 파일명에서 OS 예약 문자와 yt-dlp 템플릿 특수문자(%)를 안전하게 치환.
function sanitizeFilename(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/%/g, '％')
    .replace(/\.+$/, '')
    .slice(0, 180)
}

// yt-dlp formats use codec prefixes like avc1.xxx, vp09.xx, av01.x
const CODEC_PREFIX: Record<Exclude<VideoCodec, 'auto'>, string> = {
  h264: 'avc',
  vp9: 'vp09',
  av1: 'av01',
}

export interface DownloadCallbacks {
  onProgress: (update: ProgressUpdate) => void
  onStderr?: (line: string) => void
  onComplete: (filePath: string | null) => void
  onError: (message: string) => void
}

export interface ActiveDownload {
  id: string
  process: ChildProcess
  options: DownloadOptions
  status: DownloadStatus
}

const activeDownloads = new Map<string, ActiveDownload>()

export function getDefaultDownloadDir(): string {
  return path.join(app.getPath('downloads'), 'Dovvn')
}

function buildFormatSelector(opts: DownloadOptions): string {
  if (opts.audioOnly) return 'bestaudio/best'

  const ext = opts.format ?? 'mp4'
  const codec = opts.vcodec && opts.vcodec !== 'auto' ? opts.vcodec : null
  const codecFilter = codec ? `[vcodec^=${CODEC_PREFIX[codec]}]` : ''
  const heightFilter = opts.height ? `[height<=${opts.height}]` : ''

  const candidates = [
    `bestvideo${heightFilter}${codecFilter}[ext=${ext}]+bestaudio[ext=m4a]`,
    `bestvideo${heightFilter}${codecFilter}+bestaudio`,
    `bestvideo${heightFilter}[ext=${ext}]+bestaudio[ext=m4a]`,
    `bestvideo${heightFilter}+bestaudio`,
    `best${heightFilter}`,
    // 최종 안전망: 어떤 포맷이든 있으면 매칭 (video-only/adaptive/combined 전부 포함)
    'bv*+ba/b',
    'best',
  ]
  return candidates.join('/')
}

function buildArgs(opts: DownloadOptions): string[] {
  const args: string[] = [
    '--newline',
    '--no-warnings',
    // --print이 --quiet를 암묵적으로 켜서 진행률이 숨겨지므로 강제로 켠다
    '--progress',
    '--progress-template',
    PROGRESS_TEMPLATE,
    // DASH/HLS fragment 동시 다운로드 (기본 1 → 16). 단일 HTTP 파일엔 영향 없음.
    '-N',
    '16',
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    '--socket-timeout',
    '15',
    '-o',
    path.join(
      opts.outputDir,
      sanitizeFilename(opts.filename ?? '') ? `${sanitizeFilename(opts.filename!)}.%(ext)s` : '%(title)s.%(ext)s'
    ),
    '-f',
    buildFormatSelector(opts),
  ]

  if (opts.audioOnly) {
    args.push('-x', '--audio-format', opts.audioFormat ?? 'mp3')
  } else if (opts.format && opts.format !== 'mp4') {
    args.push('--merge-output-format', opts.format)
  } else {
    args.push('--merge-output-format', 'mp4')
  }

  if (opts.subtitles?.length) {
    args.push('--write-subs', '--sub-langs', opts.subtitles.join(','))
    // 기본은 srt. vtt로 명시된 경우만 변환 생략(원본 vtt 유지).
    const subFormat = opts.subFormat ?? 'srt'
    if (subFormat === 'srt') args.push('--convert-subs', 'srt')
    if (opts.embedSubtitles) args.push('--embed-subs')
  }

  // 구간 자르기. *prefix는 절대 시간 기준.
  // --force-keyframes-at-cuts로 정확한 컷을 보장 (재인코딩 발생).
  if (opts.trimStart && opts.trimEnd) {
    args.push('--download-sections', `*${opts.trimStart}-${opts.trimEnd}`)
    args.push('--force-keyframes-at-cuts')
  }

  args.push('--print', 'after_move:filepath')
  args.push(opts.url)
  return args
}

export function startDownload(opts: DownloadOptions, cb: DownloadCallbacks): void {
  if (activeDownloads.has(opts.id)) {
    cb.onError(`Download ${opts.id} already running`)
    return
  }

  fs.mkdirSync(opts.outputDir, { recursive: true })

  const proc = runYtDlp(buildArgs(opts))
  const entry: ActiveDownload = { id: opts.id, process: proc, options: opts, status: 'downloading' }
  activeDownloads.set(opts.id, entry)

  let stdoutBuf = ''
  let stderrBuf = ''
  let rawStderr = ''
  let finalFilePath: string | null = null

  // 가중 진행률 상태.
  // 일반 비디오는 비디오 + 오디오 2파일을 순차 다운로드하고,
  // 자막을 선택했다면 언어당 자막 파일이 추가로 다운로드된다.
  // 각 phase에 동일 비중을 할당해 전체 0~100%로 이어 붙인다.
  const subtitleCount = opts.subtitles?.length ?? 0
  const expectedPhases = (opts.audioOnly ? 1 : 2) + subtitleCount
  let currentPhase = 0
  let currentFile: string | null = null
  let lastMappedPercent = 0

  const PURE_INT = /^\d+$/

  // 파일 단위 진행률(0~100) 계산. native yt-dlp 모드에선 @@DLPROG@@의 pure 정수 바이트가 가장 정확.
  const computeFilePercent = (update: ProgressUpdate): number => {
    const d = update.downloaded?.trim() ?? ''
    const t = update.total?.trim() ?? ''
    const te = update.totalEstimate?.trim() ?? ''
    if (PURE_INT.test(d) && (PURE_INT.test(t) || PURE_INT.test(te))) {
      const dn = parseInt(d, 10)
      const tn = PURE_INT.test(t) ? parseInt(t, 10) : parseInt(te, 10)
      if (dn > 0 && tn > 0) return Math.min(100, (dn / tn) * 100)
    }
    // fragment 폴백 (DASH에서 total 미정일 때)
    const count = update.fragmentCount ?? 0
    const index = update.fragmentIndex ?? 0
    if (count > 1 && index > 0) {
      return Math.min(100, ((index - 1) / count) * 100)
    }
    const m = update.percent.match(/([\d.]+)/)
    return m ? Math.min(100, Math.max(0, parseFloat(m[1]))) : 0
  }

  const remapProgress = (update: ProgressUpdate): ProgressUpdate => {
    // phase 전환은 filename 변경으로 감지 (비디오 파일 → 오디오 파일).
    if (update.filename && update.filename !== currentFile) {
      if (currentFile !== null) {
        currentPhase = Math.min(currentPhase + 1, expectedPhases - 1)
      }
      currentFile = update.filename
    }
    const fileProgress = computeFilePercent(update)
    const slice = 100 / expectedPhases
    let mapped = currentPhase * slice + (fileProgress / 100) * slice
    if (mapped < lastMappedPercent) mapped = lastMappedPercent
    lastMappedPercent = mapped
    return { ...update, percent: `${mapped.toFixed(1)}%` }
  }

  // yt-dlp는 경우에 따라 진행률을 \n 대신 \r로 구분하거나 stderr로 보내기도 한다.
  // 둘 다 지원하도록 공통 라인 처리기를 둔다.
  const splitLines = (buf: string): { lines: string[]; rest: string } => {
    const parts = buf.split(/\r\n|\r|\n/)
    const rest = parts.pop() ?? ''
    return { lines: parts, rest }
  }

  const handleStdoutLine = (line: string): void => {
    const trimmed = line.trimEnd()
    if (!trimmed) return
    const update = parseProgressLine(trimmed)
    if (update) {
      cb.onProgress(remapProgress(update))
      return
    }
    if (!trimmed.startsWith('[')) {
      // --print after_move:filepath prints the final path
      if (fs.existsSync(trimmed)) finalFilePath = trimmed
    }
  }

  const handleStderrLine = (line: string): void => {
    const trimmed = line.trimEnd()
    if (!trimmed) return
    const update = parseProgressLine(trimmed)
    if (update) {
      cb.onProgress(remapProgress(update))
      return
    }
    if (cb.onStderr) cb.onStderr(trimmed)
  }

  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString()
    const { lines, rest } = splitLines(stdoutBuf)
    stdoutBuf = rest
    for (const line of lines) handleStdoutLine(line)
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    rawStderr += text
    stderrBuf += text
    const { lines, rest } = splitLines(stderrBuf)
    stderrBuf = rest
    for (const line of lines) handleStderrLine(line)
  })

  proc.on('error', (err) => {
    activeDownloads.delete(opts.id)
    cb.onError(err.message)
  })

  proc.on('close', (code, signal) => {
    activeDownloads.delete(opts.id)
    // 남아있는 버퍼도 한 번 더 처리
    if (stdoutBuf.trim()) handleStdoutLine(stdoutBuf)
    if (stderrBuf.trim()) handleStderrLine(stderrBuf)
    if (signal === 'SIGTERM' || entry.status === 'cancelled') {
      cb.onError('Download cancelled')
      return
    }
    if (code === 0) {
      cb.onComplete(finalFilePath)
    } else {
      cb.onError(summarizeYtDlpError(rawStderr) || `yt-dlp exited with code ${code}`)
    }
  })
}

// yt-dlp stderr에서 사용자에게 보여줄 핵심 에러 줄을 추출한다.
// 우선순위: 마지막 "ERROR:" 줄 > 파이썬 traceback의 마지막 "Type: message" > 마지막 비어있지 않은 줄
function summarizeYtDlpError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trimEnd())
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return ''

  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l.startsWith('ERROR:')) return l
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (/^[A-Za-z_][\w.]*(Error|Exception|Warning):/.test(l)) return l
  }

  return lines[lines.length - 1].trim()
}

export function cancelDownload(id: string): boolean {
  const entry = activeDownloads.get(id)
  if (!entry) return false
  entry.status = 'cancelled'
  killProcessTree(entry.process)
  return true
}

// yt-dlp는 내부에서 ffmpeg/aria2c 자식을 spawn하므로 본체만 SIGTERM하면
// 자식들이 끝날 때까지 대기 → 취소가 한참 걸린다.
// runYtDlp에서 detached로 프로세스 그룹을 만들었으므로 그룹 전체를 한 번에 죽인다.
function killProcessTree(proc: ChildProcess): void {
  const pid = proc.pid
  if (!pid) return
  try {
    // 음수 pid = 프로세스 그룹. detached로 만든 그룹을 통째로 종료.
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      proc.kill('SIGTERM')
    } catch {
      /* 이미 종료됨 */
    }
  }
  // 2초 내 종료 안 되면 SIGKILL로 강제 종료
  setTimeout(() => {
    if (proc.exitCode !== null || proc.signalCode !== null) return
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* 이미 종료됨 */
      }
    }
  }, 2000)
}

export function listActiveDownloadIds(): string[] {
  return Array.from(activeDownloads.keys())
}
