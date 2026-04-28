// YouTube 전용 fast path. yt-dlp 바이너리 대신 Innertube API를 직접 호출해
// 메타데이터(포맷, 자막, 플레이리스트)만 1~2회 HTTP 왕복으로 가져온다.
// 실제 다운로드는 계속 yt-dlp가 담당한다.
import { Innertube, UniversalCache } from 'youtubei.js'
import type {
  PlaylistEntry,
  Resolution,
  VideoFormat,
  VideoInfoBase
} from '../../preload/video-types'
import type { Platform } from './platform'

type YouTubeInfo = VideoInfoBase<Platform>

let innertubePromise: Promise<Innertube> | null = null

function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      retrieve_player: false
    }).catch((err) => {
      // 다음 호출에서 재시도할 수 있도록 실패 시 캐시 제거
      innertubePromise = null
      throw err
    })
  }
  return innertubePromise
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.pathname === '/watch') return u.searchParams.get('v')
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/)
    if (shorts) return shorts[1]
    const live = u.pathname.match(/^\/live\/([^/]+)/)
    if (live) return live[1]
    const embed = u.pathname.match(/^\/embed\/([^/]+)/)
    if (embed) return embed[1]
    return null
  } catch {
    return null
  }
}

export function extractYouTubePlaylistId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.pathname === '/playlist') return u.searchParams.get('list')
    // /watch?v=..&list=.. 형태: ?list 있으면 플레이리스트로 간주(기존 yt-dlp 동작과 맞춤)
    return u.searchParams.get('list')
  } catch {
    return null
  }
}

function parseMimeType(mime: string | undefined): { ext: string; codec: string | null } {
  if (!mime) return { ext: 'mp4', codec: null }
  const match = mime.match(/^(?:video|audio)\/([^;]+)(?:;\s*codecs="([^"]+)")?/)
  if (!match) return { ext: 'mp4', codec: null }
  return { ext: match[1].trim(), codec: match[2]?.trim() ?? null }
}

interface InnertubeFormat {
  itag: number
  mime_type: string
  bitrate: number
  width?: number
  height?: number
  fps?: number
  quality_label?: string
  content_length?: number
  has_audio: boolean
  has_video: boolean
}

function toFormat(f: InnertubeFormat): VideoFormat {
  const { ext, codec } = parseMimeType(f.mime_type)
  const isVideo = f.has_video
  const isAudio = f.has_audio
  return {
    formatId: String(f.itag),
    ext,
    resolution: f.quality_label ?? (f.width && f.height ? `${f.width}x${f.height}` : null),
    width: f.width ?? null,
    height: f.height ?? null,
    fps: f.fps ?? null,
    vcodec: isVideo ? codec ?? 'unknown' : 'none',
    acodec: isAudio ? codec ?? 'unknown' : 'none',
    filesize: f.content_length ? Number(f.content_length) : null,
    tbr: f.bitrate ? f.bitrate / 1000 : null,
    note: f.quality_label ?? null
  }
}

function extractResolutions(formats: VideoFormat[]): Resolution[] {
  const map = new Map<number, Resolution>()
  for (const f of formats) {
    if (!f.width || !f.height) continue
    if (!f.vcodec || f.vcodec === 'none') continue
    const short = Math.min(f.width, f.height)
    const existing = map.get(short)
    if (!existing || Math.max(f.width, f.height) > Math.max(existing.width, existing.height)) {
      map.set(short, { short, width: f.width, height: f.height })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.short - a.short)
}

function pickThumbnail(thumbnails: Array<{ url: string; width?: number }> | undefined): string | null {
  if (!thumbnails || thumbnails.length === 0) return null
  // 가장 큰 썸네일
  const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  return sorted[0]?.url ?? null
}

async function fetchSingleVideo(yt: Innertube, videoId: string, url: string): Promise<YouTubeInfo> {
  // IOS 클라이언트: PO token 불필요, formats/captions 모두 정상 반환, signature_cipher 없음.
  const info = await yt.getBasicInfo(videoId, { client: 'IOS' })

  const basic = info.basic_info
  const rawFormats: InnertubeFormat[] = [
    ...(info.streaming_data?.formats ?? []),
    ...(info.streaming_data?.adaptive_formats ?? [])
  ] as InnertubeFormat[]
  const formats = rawFormats.map(toFormat)
  if (formats.length === 0) {
    // 포맷이 비어있으면 fast path 실패로 간주 → yt-dlp 폴백
    throw new Error('Innertube returned no formats')
  }

  const captionTracks = info.captions?.caption_tracks ?? []
  const manualLangs = new Set<string>()
  const asrLangs = new Set<string>()
  for (const t of captionTracks) {
    if (t.kind === 'asr') asrLangs.add(t.language_code)
    else manualLangs.add(t.language_code)
  }
  // translation_languages: YouTube 번역 대상 언어(자동 번역) — yt-dlp의 automatic_captions와 매칭
  const translationLangs = (info.captions?.translation_languages ?? []).map((t) => t.language_code)
  const autoLangs = new Set<string>([...asrLangs, ...translationLangs])
  for (const l of manualLangs) autoLangs.delete(l)

  return {
    id: basic.id ?? videoId,
    title: basic.title ?? '(제목 없음)',
    thumbnail: pickThumbnail(basic.thumbnail),
    duration: basic.duration ?? null,
    uploader: basic.author ?? null,
    platform: 'youtube',
    platformName: 'YouTube',
    webpageUrl: basic.url_canonical ?? url,
    formats,
    availableResolutions: extractResolutions(formats),
    subtitles: Array.from(manualLangs),
    autoSubtitles: Array.from(autoLangs),
    isPlaylist: false
  }
}

async function fetchPlaylist(yt: Innertube, playlistId: string, url: string): Promise<YouTubeInfo> {
  const pl = await yt.getPlaylist(playlistId)
  const entries: PlaylistEntry[] = []
  for (const item of pl.items) {
    // PlaylistVideo만 다룬다(ReelItem, ShortsLockupView는 스킵)
    if (item.type !== 'PlaylistVideo') continue
    const v = item as unknown as {
      id: string
      title: { text?: string }
      duration?: { seconds?: number }
      thumbnails: Array<{ url: string; width?: number }>
    }
    entries.push({
      id: v.id,
      title: v.title.text ?? '(제목 없음)',
      url: `https://www.youtube.com/watch?v=${v.id}&list=${playlistId}`,
      duration: v.duration?.seconds ?? null,
      thumbnail: pickThumbnail(v.thumbnails)
    })
  }

  const firstId = entries[0]?.id
  return {
    id: playlistId,
    title: pl.info.title ?? '(제목 없음)',
    thumbnail: pickThumbnail(pl.info.thumbnails),
    duration: null,
    uploader: pl.info.author?.name ?? null,
    platform: 'youtube',
    platformName: 'YouTube',
    webpageUrl: url,
    formats: [],
    availableResolutions: [],
    subtitles: [],
    autoSubtitles: [],
    isPlaylist: true,
    entries: entries.length > 0 ? entries : firstId ? [] : []
  }
}

export async function fetchYouTubeInfoFast(url: string): Promise<YouTubeInfo> {
  const yt = await getInnertube()
  const playlistId = extractYouTubePlaylistId(url)
  const videoId = extractYouTubeVideoId(url)

  // 순수 플레이리스트 URL(/playlist?list=..)이거나 ?list= 있고 ?v= 없으면 플레이리스트로 처리
  if (playlistId && !videoId) {
    return fetchPlaylist(yt, playlistId, url)
  }
  // watch?v=X&list=Y: 기존 yt-dlp 동작(--flat-playlist)과 맞추기 위해 플레이리스트 우선
  if (playlistId && videoId) {
    return fetchPlaylist(yt, playlistId, url)
  }
  if (videoId) {
    return fetchSingleVideo(yt, videoId, url)
  }
  throw new Error('YouTube URL에서 video/playlist id를 찾지 못했습니다.')
}
