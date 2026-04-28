// Main(parser) ↔ Renderer(types) 사이에서 공유되는 비디오 정보 타입.
// IPC 페이로드 필드가 한 쪽에서만 바뀌어 silent drop 되는 일을 막기 위한 단일 출처.
// Platform 타입은 main/renderer 각자의 정의가 다를 수 있어 제네릭으로 남겨둔다.

export interface VideoFormat {
  formatId: string
  ext: string
  resolution: string | null
  width: number | null
  height: number | null
  fps: number | null
  vcodec: string | null
  acodec: string | null
  filesize: number | null
  tbr: number | null
  note: string | null
}

/** 해상도 옵션. short = min(width, height) — YouTube 라벨 기준(720p 등) */
export interface Resolution {
  short: number
  width: number
  height: number
}

export interface PlaylistEntry {
  id: string
  title: string
  url: string
  duration: number | null
  thumbnail: string | null
}

export interface VideoInfoBase<P extends string = string> {
  id: string
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  platform: P
  platformName: string
  webpageUrl: string
  formats: VideoFormat[]
  availableResolutions: Resolution[]
  /** 업로더가 직접 올린 원본 자막 언어 코드 */
  subtitles: string[]
  /** YouTube 등이 자동 생성한 번역 자막 언어 코드 */
  autoSubtitles: string[]
  isPlaylist: boolean
  entries?: PlaylistEntry[]
}
