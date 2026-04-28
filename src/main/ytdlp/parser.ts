import { detectPlatform, type Platform } from './platform'
import { runYtDlpOnce } from './runner'
import { fetchYouTubeInfoFast } from './youtube-fast'
import type {
  PlaylistEntry,
  Resolution,
  VideoFormat,
  VideoInfoBase
} from '../../preload/video-types'

export type { VideoFormat, Resolution, PlaylistEntry }
export type VideoInfo = VideoInfoBase<Platform>

interface RawFormat {
  format_id: string
  ext: string
  resolution?: string
  width?: number
  height?: number
  fps?: number
  vcodec?: string
  acodec?: string
  filesize?: number | null
  filesize_approx?: number | null
  tbr?: number
  format_note?: string
}

interface RawInfo {
  id: string
  title: string
  thumbnail?: string | null
  duration?: number | null
  uploader?: string | null
  extractor_key?: string
  extractor?: string
  webpage_url: string
  formats?: RawFormat[]
  subtitles?: Record<string, unknown>
  automatic_captions?: Record<string, unknown>
  _type?: string
  entries?: RawPlaylistEntry[]
}

interface RawPlaylistEntry {
  id: string
  title?: string
  url?: string
  webpage_url?: string
  duration?: number | null
  thumbnail?: string | null
  thumbnails?: Array<{ url: string }>
}

function toFormat(raw: RawFormat): VideoFormat {
  return {
    formatId: raw.format_id,
    ext: raw.ext,
    resolution: raw.resolution ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    fps: raw.fps ?? null,
    vcodec: raw.vcodec ?? null,
    acodec: raw.acodec ?? null,
    filesize: raw.filesize ?? raw.filesize_approx ?? null,
    tbr: raw.tbr ?? null,
    note: raw.format_note ?? null,
  }
}

function extractResolutions(formats: VideoFormat[]): Resolution[] {
  const map = new Map<number, Resolution>()
  for (const f of formats) {
    if (!f.width || !f.height) continue
    if (!f.vcodec || f.vcodec === 'none') continue
    const short = Math.min(f.width, f.height)
    const existing = map.get(short)
    // 같은 짧은 변 값에서 더 큰 긴 변(=더 완전한 해상도) 유지
    if (!existing || Math.max(f.width, f.height) > Math.max(existing.width, existing.height)) {
      map.set(short, { short, width: f.width, height: f.height })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.short - a.short)
}

function extractSubtitleLangs(raw: RawInfo): { original: string[]; auto: string[] } {
  const original = raw.subtitles ? Object.keys(raw.subtitles) : []
  const autoAll = raw.automatic_captions ? Object.keys(raw.automatic_captions) : []
  // 원본에 있는 언어는 자동에서 제거(중복 방지)
  const originalSet = new Set(original)
  const auto = autoAll.filter((l) => !originalSet.has(l))
  return { original, auto }
}

function toPlaylistEntry(raw: RawPlaylistEntry): PlaylistEntry {
  return {
    id: raw.id,
    title: raw.title ?? '(제목 없음)',
    url: raw.webpage_url ?? raw.url ?? '',
    duration: raw.duration ?? null,
    thumbnail: raw.thumbnail ?? raw.thumbnails?.[raw.thumbnails.length - 1]?.url ?? null,
  }
}

async function fetchWithYtDlp(url: string): Promise<VideoInfo> {
  const { code, stdout, stderr } = await runYtDlpOnce([
    '--dump-single-json',
    '--no-warnings',
    '--flat-playlist',
    '--socket-timeout',
    '15',
    '--retries',
    '2',
    url,
  ])

  if (code !== 0) {
    throw new Error(stderr.trim() || `yt-dlp exited with code ${code}`)
  }

  const raw = JSON.parse(stdout) as RawInfo
  const platform = detectPlatform(raw.webpage_url || url)
  const isPlaylist = raw._type === 'playlist' || Array.isArray(raw.entries)
  const formats = (raw.formats ?? []).map(toFormat)
  const subs = extractSubtitleLangs(raw)

  return {
    id: raw.id,
    title: raw.title,
    thumbnail: raw.thumbnail ?? null,
    duration: raw.duration ?? null,
    uploader: raw.uploader ?? null,
    platform,
    platformName: raw.extractor_key ?? raw.extractor ?? platform,
    webpageUrl: raw.webpage_url,
    formats,
    availableResolutions: extractResolutions(formats),
    subtitles: subs.original,
    autoSubtitles: subs.auto,
    isPlaylist,
    entries: isPlaylist ? raw.entries?.map(toPlaylistEntry) : undefined,
  }
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  // YouTube는 Innertube fast path를 먼저 시도. 실패 시 yt-dlp 폴백.
  if (detectPlatform(url) === 'youtube') {
    try {
      return await fetchYouTubeInfoFast(url)
    } catch (err) {
      console.warn('[fetchVideoInfo] youtube fast path failed, falling back to yt-dlp:', err)
    }
  }
  return fetchWithYtDlp(url)
}

export interface ProgressUpdate {
  percent: string
  speed: string
  eta: string
  downloaded: string
  total: string
  // 바이트 기반 진행률 계산용. total이 미정일 때 폴백.
  totalEstimate?: string
  // fragmented(DASH/HLS) 진행률 보조
  fragmentIndex?: number | null
  fragmentCount?: number | null
  // 비디오→오디오 같은 파일 전환 감지용 (filename 바뀌면 새 phase)
  filename?: string | null
}

function parseIntOrNull(s: string | undefined): number | null {
  if (!s) return null
  const t = s.trim()
  if (!t || t === 'NA') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

const PROGRESS_MARKER = '@@DLPROG@@'

// yt-dlp 기본 진행률 라인: "[download]   1.2% of ~  15.34MiB at    1.23MiB/s ETA 00:12"
// 완료 직전 라인:            "[download] 100% of 15.34MiB in 00:12 at 1.23MiB/s"
const DEFAULT_PROGRESS_RE =
  /^\[download\]\s+([\d.]+)%\s+of\s+~?\s*(\S+)(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/

// aria2c 외부 다운로더 진행률 라인:
// "[#9e8a57 464KiB/273MiB(0%) CN:16 DL:0.9MiB ETA:5m1s]"
// "[#3e9bec 30MiB/31MiB(97%) CN:1 DL:6.3MiB]"           (ETA 없는 경우)
// 첫 번째 그룹은 gid. 파일 식별자로 사용해 phase 전환 감지에 쓴다.
const ARIA2C_PROGRESS_RE =
  /\[#([^ \]]+)\s+(\S+?)\/(\S+?)\((\d+)%\)\s+CN:\d+\s+DL:(\S+?)(?:\s+ETA:(\S+?))?\]/

export function parseProgressLine(line: string): ProgressUpdate | null {
  // 1) 커스텀 템플릿 출력
  // 형식(9개 필드, filename은 '|'를 포함할 수 있어 마지막 위치):
  //   MARK|percent|speed|eta|downloaded_bytes|total_bytes|total_bytes_estimate|fragment_index|fragment_count|filename...
  if (line.startsWith(PROGRESS_MARKER + '|')) {
    const all = line.slice(PROGRESS_MARKER.length + 1).split('|')
    if (all.length < 9) return null
    const [percent, speed, eta, downloaded, total, totalEst, fragIdx, fragCount, ...rest] = all
    const filename = rest.join('|').trim()
    return {
      percent: percent.trim(),
      speed: speed.trim(),
      eta: eta.trim(),
      downloaded: downloaded.trim(),
      total: total.trim(),
      totalEstimate: totalEst.trim(),
      fragmentIndex: parseIntOrNull(fragIdx),
      fragmentCount: parseIntOrNull(fragCount),
      filename: filename && filename !== 'NA' ? filename : null,
    }
  }

  // 2) 기본 포맷 (yt-dlp 버전 호환용 폴백)
  const m = line.match(DEFAULT_PROGRESS_RE)
  if (m) {
    return {
      percent: `${m[1]}%`,
      speed: m[3] ?? '-',
      eta: m[4] ?? '-',
      downloaded: '',
      total: m[2] ?? '',
    }
  }

  // 3) aria2c 외부 다운로더 진행률
  // 그룹: 1=gid, 2=downloaded, 3=total, 4=percent, 5=speed, 6=eta
  // gid를 filename 필드에 "aria2c:<gid>"로 넣어 파일 전환 감지에 쓴다.
  const a = line.match(ARIA2C_PROGRESS_RE)
  if (a) {
    return {
      percent: `${a[4]}%`,
      speed: `${a[5]}/s`,
      eta: a[6] ?? '-',
      downloaded: a[2],
      total: a[3],
      filename: `aria2c:${a[1]}`,
    }
  }

  return null
}

// "download:" 접두어는 yt-dlp가 TYPES 지정자로 소비하여 실제 출력 라인에는 남지 않는다.
// 따라서 고유 마커(@@DLPROG@@)를 템플릿 맨 앞에 두어 다른 stdout 로그와 구분한다.
export const PROGRESS_TEMPLATE =
  `download:${PROGRESS_MARKER}|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.fragment_index)s|%(progress.fragment_count)s|%(progress.filename)s`
