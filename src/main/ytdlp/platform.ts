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

const PATTERNS: Array<[Platform, RegExp]> = [
  ['youtube', /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i],
  ['vimeo', /vimeo\.com/i],
  ['tiktok', /tiktok\.com/i],
  ['instagram', /instagram\.com/i],
  ['twitter', /(?:twitter\.com|x\.com)/i],
  ['facebook', /(?:facebook\.com|fb\.watch)/i],
  ['twitch', /twitch\.tv/i],
  ['soundcloud', /soundcloud\.com/i],
  ['naver', /(?:tv\.naver\.com|blog\.naver\.com)/i],
  ['kakao', /tv\.kakao\.com/i],
]

export function detectPlatform(url: string): Platform {
  for (const [platform, regex] of PATTERNS) {
    if (regex.test(url)) return platform
  }
  return 'other'
}

export const PLATFORM_DIR_NAMES: Record<Platform, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter',
  facebook: 'Facebook',
  twitch: 'Twitch',
  soundcloud: 'SoundCloud',
  naver: 'Naver',
  kakao: 'Kakao',
  other: 'Other',
}
