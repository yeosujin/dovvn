// electron-builder afterSign 훅
// macOS 26+에서 ad-hoc 서명된 Electron 앱이 "different Team IDs"로 실행 실패하는 문제 회피.
//
// 1) Contents/Frameworks/ 안의 Electron Framework / Helper 등만 일관된 ad-hoc으로 --deep 재서명
// 2) yt-dlp / ffmpeg 는 electron-builder가 패키징 중 재서명하면서 내부 PyInstaller 아카이브와
//    서명이 어긋나 Python.framework dlopen이 실패한다. → 원본 바이너리를 복원한다.
// 3) 최상위 .app은 --deep 없이 재서명(원본이 복원된 상태의 해시로 re-seal)
// 4) 확장 속성 제거
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function restoreOriginalBinaries(appPath, projectRoot) {
  const srcDir = path.join(projectRoot, 'resources', 'bin')
  const dstDir = path.join(appPath, 'Contents', 'Resources', 'bin')
  if (!fs.existsSync(srcDir) || !fs.existsSync(dstDir)) return
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name)
    const dst = path.join(dstDir, name)
    const stat = fs.statSync(src)
    if (!stat.isFile()) continue
    console.log(`[afterSign] Restoring original ${name}`)
    fs.copyFileSync(src, dst)
    fs.chmodSync(dst, 0o755)
  }
}

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  const projectRoot = context.packager.projectDir

  console.log(`[afterSign] Fixing code signatures: ${appPath}`)

  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })

    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks')
    if (fs.existsSync(frameworksDir)) {
      for (const entry of fs.readdirSync(frameworksDir)) {
        if (entry.endsWith('.framework') || entry.endsWith('.app')) {
          const full = path.join(frameworksDir, entry)
          console.log(`[afterSign] Deep-signing ${entry}`)
          execSync(`codesign --force --deep --sign - "${full}"`, { stdio: 'inherit' })
        }
      }
    }

    restoreOriginalBinaries(appPath, projectRoot)

    console.log('[afterSign] Re-sealing outer app (no --deep)')
    execSync(`codesign --force --sign - "${appPath}"`, { stdio: 'inherit' })

    console.log('[afterSign] Done.')
  } catch (err) {
    console.error('[afterSign] Failed:', err)
    throw err
  }
}
