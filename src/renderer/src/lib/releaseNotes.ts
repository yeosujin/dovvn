import type { ReleaseNotesEntry } from '../../../preload/index'

/** 마크다운/플레인 텍스트에서 bullet 항목만 추출. "- xxx" / "* xxx" 모두 매칭. */
export function extractBullets(notes: string, limit = 6): string[] {
  if (!notes) return []
  return notes
    .split('\n')
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim())
    .filter((x): x is string => Boolean(x))
    .slice(0, limit)
}

/** 개발 환경에서 컴포넌트 디자인 확인용 mock.
 *  release notes는 사용자가 한눈에 알 수 있도록 "기능 단위"로 짧고 명확하게 작성. */
export const DEV_MOCK_RELEASE_NOTES: ReleaseNotesEntry = {
  version: 'dev-preview',
  notes: `- 영상 구간 자르기 추가 (시작·끝 시간 지정)
- 업데이트 변경사항 안내 추가
- yt-dlp 안정성 개선`,
  installedAt: Date.now()
}
