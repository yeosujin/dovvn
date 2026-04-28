import type { Platform } from '../constants/platforms'
import type { DownloadOptionsValue } from '../components/DownloadOptions'
import type {
  PlaylistEntry,
  Resolution,
  VideoFormat,
  VideoInfoBase
} from '../../../preload/video-types'

export type { VideoFormat, Resolution, PlaylistEntry }
export type VideoInfo = VideoInfoBase<Platform>

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled'

export interface DownloadItem {
  id: string
  url: string
  title: string
  platform: Platform
  thumbnail: string | null
  status: DownloadStatus
  percent: string
  speed: string
  eta: string
  filePath: string | null
  error: string | null
  createdAt: number
  options: DownloadOptionsValue
}
