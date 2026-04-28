// BCP 47 언어 코드 → 해당 언어의 자국어 이름(가능할 때) 또는 사용자 locale 이름
// 예: "ko" → "한국어", "en" → "English", "ja" → "日本語"
export function nativeLangLabel(code: string): string {
  const normalized = code.trim()
  if (!normalized) return code
  try {
    const [lang, region] = normalized.split('-')
    // 1차: 자기 자신 언어로 이름 얻기 시도
    const dnNative = new Intl.DisplayNames([normalized], { type: 'language', fallback: 'code' })
    let langName = dnNative.of(lang) ?? lang
    // 2차: 결과가 코드 그대로이면(예: "Aa") 영어 이름으로 폴백
    if (langName.toLowerCase() === lang.toLowerCase()) {
      try {
        const dnEn = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' })
        const en = dnEn.of(lang)
        if (en && en.toLowerCase() !== lang.toLowerCase()) langName = en
      } catch {
        /* noop */
      }
    }
    const pretty = langName.charAt(0).toLocaleUpperCase(normalized) + langName.slice(1)
    if (region) {
      try {
        const rn = new Intl.DisplayNames([normalized], { type: 'region', fallback: 'code' })
        const regionName = rn.of(region.toUpperCase())
        if (regionName && regionName !== region.toUpperCase()) {
          return `${pretty} (${regionName})`
        }
      } catch {
        /* noop */
      }
    }
    return pretty
  } catch {
    return normalized
  }
}

// 주요 언어를 맨 앞에 두고, 나머지는 이름 기준 오름차순.
const PRIMARY_ORDER = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'zh']
export function sortLangs(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const ai = PRIMARY_ORDER.indexOf(a)
    const bi = PRIMARY_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return nativeLangLabel(a).localeCompare(nativeLangLabel(b))
  })
}

/**
 * 같은 표시 이름으로 렌더링되는 코드가 여러 개일 때 하나만 남긴다.
 * 우선순위: 지역코드 없는 순수 언어 코드(ko) > 지역코드 포함(ko-KR) > 그 외
 */
export function dedupeLangsByLabel(codes: string[]): string[] {
  const byLabel = new Map<string, string>()
  for (const code of codes) {
    const label = nativeLangLabel(code)
    const existing = byLabel.get(label)
    if (!existing) {
      byLabel.set(label, code)
      continue
    }
    // 지역코드 없는 쪽을 우선
    const existingHasRegion = existing.includes('-')
    const currentHasRegion = code.includes('-')
    if (existingHasRegion && !currentHasRegion) {
      byLabel.set(label, code)
    } else if (!existingHasRegion && currentHasRegion) {
      // 유지
    } else if (code.length < existing.length) {
      byLabel.set(label, code)
    }
  }
  return Array.from(byLabel.values())
}
