import {
  siYoutube,
  siVimeo,
  siTiktok,
  siInstagram,
  siX,
  siFacebook,
  siTwitch,
  siSoundcloud,
  siNaver,
  siKakaotalk,
  type SimpleIcon
} from 'simple-icons'

export type Platform =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'twitch'
  | 'soundcloud'
  | 'naver'
  | 'kakao'
  | 'other'

export interface PlatformMeta {
  name: string
  icon: SimpleIcon | null
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube: { name: 'YouTube', icon: siYoutube },
  vimeo: { name: 'Vimeo', icon: siVimeo },
  tiktok: { name: 'TikTok', icon: siTiktok },
  instagram: { name: 'Instagram', icon: siInstagram },
  twitter: { name: 'X', icon: siX },
  facebook: { name: 'Facebook', icon: siFacebook },
  twitch: { name: 'Twitch', icon: siTwitch },
  soundcloud: { name: 'SoundCloud', icon: siSoundcloud },
  naver: { name: 'Naver', icon: siNaver },
  kakao: { name: 'Kakao', icon: siKakaotalk },
  other: { name: '기타', icon: null }
}
