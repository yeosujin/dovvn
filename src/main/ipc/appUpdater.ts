import { spawn, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  chmodSync,
  readdirSync,
  statSync,
  existsSync,
  accessSync,
  constants
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, type UpdateDownloadedEvent } from 'electron-updater'
import { setLastReleaseNotes } from './settings'
import { requestRestart } from '../restart'

function normalizeReleaseNotes(notes: string | Array<{ version: string; note: string | null }> | null | undefined): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  // electron-updater가 배열 형태로 줄 때(여러 버전 누적): 가장 최근 버전 노트만
  return notes.map((n) => n.note ?? '').filter(Boolean).join('\n\n')
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false

// 자동 재시작은 클릭 없이 일어나므로, 방금 끝난 다운로드의 상태가 저장되고 안내 문구가 보일 시간을 준다.
const QUIT_DELAY_MS = 1_500

let downloadedFile: string | null = null

function send(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

// downloadedFile은 .app 또는 .zip이다. zip이면 직접 풀어 .app 경로를 만들어둔다.
// 실패 시 null을 반환해서 호출부에서 안전하게 fallback할 수 있게 한다.
function prepareNewApp(file: string): string | null {
  if (file.endsWith('.app') && existsSync(file)) return file

  const dir = path.dirname(file)

  // 이미 풀려있는 .app이 있으면 가장 최근 것을 쓴다.
  let newest: { p: string; mtime: number } | null = null
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.app')) continue
    const p = path.join(dir, name)
    const m = statSync(p).mtimeMs
    if (!newest || m > newest.mtime) newest = { p, mtime: m }
  }
  if (newest && existsSync(newest.p)) return newest.p

  // zip이면 임시 디렉토리에 풀어준다 (ditto는 macOS 표준).
  if (file.endsWith('.zip') && existsSync(file)) {
    const out = mkdtempSync(path.join(tmpdir(), 'dovvn-extract-'))
    const r = spawnSync('/usr/bin/ditto', ['-x', '-k', file, out], { stdio: 'ignore' })
    if (r.status !== 0) return null
    for (const name of readdirSync(out)) {
      if (name.endsWith('.app')) return path.join(out, name)
    }
  }
  return null
}

// 실행 중인 Dovvn.app 경로. exe는 Dovvn.app/Contents/MacOS/Dovvn 이다.
function getCurrentAppPath(): string {
  return path.dirname(path.dirname(path.dirname(app.getPath('exe'))))
}

// 앱을 교체(mv)하려면 앱이 있는 폴더에 쓸 수 있어야 한다.
// ~/Downloads에서 실행 중이라 읽기 전용 경로에 격리됐거나 관리자 권한이 없으면 교체가 매번 실패하고,
// 자동 재시작에서는 실행할 때마다 같은 시도를 되풀이하게 되므로 미리 걸러낸다.
function canReplaceApp(): boolean {
  try {
    accessSync(path.dirname(getCurrentAppPath()), constants.W_OK)
    return true
  } catch {
    return false
  }
}

function runReplaceScript(newAppPath: string, pendingDir: string): void {
  const currentAppPath = getCurrentAppPath()
  const pid = process.pid
  const logPath = path.join(tmpdir(), 'dovvn-update.log')

  // 새 .app이 실제 존재하는지 미리 검증해 안전성을 확보 (스크립트가 기존 앱을 먼저 지우므로 중요)
  const script = `#!/bin/bash
exec >>"${logPath}" 2>&1
echo "[$(date)] update start pid=${pid}"
echo "current=${currentAppPath}"
echo "new=${newAppPath}"

if [ ! -d "${newAppPath}" ]; then
  echo "ERROR: new app not found, abort"
  exit 1
fi

# 앱 종료 대기 (최대 30초)
for i in {1..60}; do
  if ! kill -0 ${pid} 2>/dev/null; then break; fi
  sleep 0.5
done

# 혹시 살아있으면 강제 종료
kill -9 ${pid} 2>/dev/null || true
sleep 0.5

# 새 앱이 격리 속성 갖고 있을 수 있으니 제거
xattr -cr "${newAppPath}" 2>/dev/null || true

# 백업 후 교체 (실패 시 롤백)
BACKUP="${currentAppPath}.bak.$$"
if [ -d "${currentAppPath}" ]; then
  mv "${currentAppPath}" "$BACKUP" || { echo "ERROR: backup failed"; exit 1; }
fi

if mv "${newAppPath}" "${currentAppPath}"; then
  rm -rf "$BACKUP" 2>/dev/null || true
  # pending 폴더 정리
  rm -rf "${pendingDir}"/*.app "${pendingDir}"/*.zip "${pendingDir}"/*.dmg "${pendingDir}"/*.blockmap "${pendingDir}"/update-info.json 2>/dev/null || true
  open "${currentAppPath}"
  echo "[$(date)] update done"
else
  echo "ERROR: move failed, rolling back"
  [ -d "$BACKUP" ] && mv "$BACKUP" "${currentAppPath}"
  open "${currentAppPath}" 2>/dev/null || true
  exit 1
fi
`

  const dir = mkdtempSync(path.join(tmpdir(), 'dovvn-update-'))
  const scriptPath = path.join(dir, 'apply.sh')
  writeFileSync(scriptPath, script)
  chmodSync(scriptPath, 0o755)

  const child = spawn('/bin/bash', [scriptPath], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
}

// ad-hoc 서명 환경에선 Squirrel 자동 설치가 검증 실패하므로,
// 외부 셸 스크립트가 앱 종료 후 /Applications/Dovvn.app을 새 버전으로 덮어쓰고 재실행한다.
// 교체를 시작했으면 true, 시작하지 못했으면 false를 반환한다. 시작하지 못한 이유는 app-update:error로 알린다.
function installDownloadedUpdate(): boolean {
  try {
    if (!downloadedFile) {
      // update-downloaded에서 항상 채워지므로 정상 경로에선 도달하지 않는다.
      // ad-hoc 서명 빌드에선 Squirrel 설치가 실패해 종료되지 않을 수 있어 대기 상태를 풀어 둔다.
      autoUpdater.quitAndInstall()
      return false
    }
    if (!canReplaceApp()) {
      send(
        'app-update:error',
        '앱이 있는 폴더에 쓸 수 없어 업데이트를 설치하지 못했어요. 앱을 Applications 폴더 등 쓸 수 있는 위치로 옮기거나 관리자에게 문의해주세요.'
      )
      return false
    }
    const newAppPath = prepareNewApp(downloadedFile)
    if (!newAppPath) {
      send('app-update:error', '업데이트 파일을 준비하지 못했어요. 잠시 후 다시 시도해주세요.')
      return false
    }
    const pendingDir = path.dirname(downloadedFile)
    runReplaceScript(newAppPath, pendingDir)
    setTimeout(() => app.quit(), QUIT_DELAY_MS)
    return true
  } catch (e) {
    send(
      'app-update:error',
      `업데이트를 설치하지 못했어요: ${e instanceof Error ? e.message : String(e)}`
    )
    return false
  }
}

export function registerAppUpdaterIpc(): void {
  autoUpdater.on('checking-for-update', () => send('app-update:checking'))
  autoUpdater.on('update-available', (info) => send('app-update:available', info))
  autoUpdater.on('update-not-available', (info) => send('app-update:not-available', info))
  autoUpdater.on('error', (err) => send('app-update:error', String(err?.message ?? err)))
  autoUpdater.on('download-progress', (p) => send('app-update:progress', p))
  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    downloadedFile = info.downloadedFile ?? null
    const notes = normalizeReleaseNotes(info.releaseNotes)
    if (info.version) {
      setLastReleaseNotes({
        version: info.version,
        notes,
        installedAt: Date.now()
      })
    }
    send('app-update:downloaded', info)
    // 진행 중인 다운로드가 있으면 끝난 뒤에, 없으면 바로 재시작한다.
    requestRestart('app-update', installDownloadedUpdate)
  })

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('app-update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true as const, version: result?.updateInfo.version ?? null }
    } catch (e) {
      return { ok: false as const, error: String((e as Error).message ?? e) }
    }
  })

  ipcMain.handle('app-update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: String((e as Error).message ?? e) }
    }
  })
}
