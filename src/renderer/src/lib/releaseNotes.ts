/** 마크다운/플레인 텍스트에서 bullet 항목만 추출. "- xxx" / "* xxx" 모두 매칭. */
export function extractBullets(notes: string, limit = 6): string[] {
  if (!notes) return []
  return notes
    .split('\n')
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim())
    .filter((x): x is string => Boolean(x))
    .slice(0, limit)
}
