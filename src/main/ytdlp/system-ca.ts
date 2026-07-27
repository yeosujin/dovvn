import { app } from 'electron'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// SystemRootCertificates: 공개 루트 CA. System: 조직이 배포한 CA(MDM 등).
// 사내 TLS 인터셉트 프록시(Zscaler 등)의 루트 CA는 후자에 설치된다.
const KEYCHAINS = [
  '/System/Library/Keychains/SystemRootCertificates.keychain',
  '/Library/Keychains/System.keychain'
]

let caBundlePath: string | null = null

/**
 * macOS 시스템 키체인의 CA를 PEM 번들로 추출해 userData에 저장한다.
 *
 * 번들 yt-dlp는 PyInstaller에 포함된 certifi만 신뢰하므로, TLS를 가로채
 * 인증서를 재서명하는 사내 프록시 환경에서 CERTIFICATE_VERIFY_FAILED로 실패한다.
 * 시스템 키체인에는 해당 프록시의 루트 CA가 이미 설치되어 있으므로 그것을 넘겨준다.
 *
 * macOS가 아니거나 추출에 실패하면 경로는 null로 남고, 호출 측은 기존대로 동작한다.
 */
export function initSystemCa(): void {
  if (process.platform !== 'darwin') return
  try {
    const pem = KEYCHAINS.map((keychain) =>
      execFileSync('/usr/bin/security', ['find-certificate', '-a', '-p', keychain], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
      })
    ).join('')
    if (!pem.includes('BEGIN CERTIFICATE')) return
    const dest = path.join(app.getPath('userData'), 'system-ca.pem')
    fs.writeFileSync(dest, pem)
    caBundlePath = dest
  } catch (err) {
    console.warn('[system-ca] 시스템 CA 추출 실패, 기본 CA로 동작합니다:', err)
  }
}

export function getSystemCaPath(): string | null {
  return caBundlePath
}
