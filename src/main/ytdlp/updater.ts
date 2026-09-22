import { app, BrowserWindow, ipcMain } from 'electron'
import { requestRestart } from '../restart'
import { runYtDlpOnce } from './runner'

const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000
const RESTART_DELAY_MS = 1_500
const AUTO_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export async function getVersion(): Promise<string> {
  const { code, stdout, stderr, timedOut } = await runYtDlpOnce(['--version'], {
    timeoutMs: VERSION_TIMEOUT_MS
  })
  if (timedOut) throw new Error('yt-dlp --version 응답 없음 (타임아웃)')
  if (code !== 0) throw new Error(stderr.trim() || `yt-dlp --version exit ${code}`)
  return stdout.trim()
}

async function tryGetVersion(): Promise<string> {
  try {
    return await getVersion()
  } catch {
    return '?'
  }
}

type RestartMode = 'now' | 'deferred' | 'none'

// 새 yt-dlp를 쓰려면 앱을 재시작해야 한다. 진행 중인 다운로드가 있으면 끝난 뒤에 재시작한다.
function restartToApplyUpdate(): RestartMode {
  if (!app.isPackaged) {
    console.log('[updater] 개발 모드라 yt-dlp 업데이트 후 재시작을 건너뜁니다')
    return 'none'
  }
  return requestRestart('ytdlp-update', () => {
    // 렌더러가 결과 메시지를 표시할 시간을 준다.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, RESTART_DELAY_MS)
    return true
  })
}

interface UpdateOutcome {
  beforeVersion: string
  afterVersion: string
  log: string
  restart: RestartMode
}

let inFlightUpdate: Promise<UpdateOutcome> | null = null

// 자동 주기 확인과 수동 확인(설정 패널)이 겹쳐도 yt-dlp -U가 같은 바이너리에
// 두 번 실행되지 않도록, 진행 중이면 새 호출도 같은 결과를 기다리게 한다.
export function update(): Promise<UpdateOutcome> {
  if (inFlightUpdate) return inFlightUpdate
  inFlightUpdate = runUpdate().finally(() => {
    inFlightUpdate = null
  })
  return inFlightUpdate
}

async function runUpdate(): Promise<UpdateOutcome> {
  broadcast('ytdlp:update:log', '업데이트 확인 중...')
  const before = await tryGetVersion()
  const { code, stdout, stderr, timedOut } = await runYtDlpOnce(['-U'], {
    timeoutMs: UPDATE_TIMEOUT_MS,
    onStdoutLine: (line) => broadcast('ytdlp:update:log', line),
    onStderrLine: (line) => broadcast('ytdlp:update:log', line)
  })
  const log = (stdout + stderr).trim()
  if (timedOut) {
    throw new Error(
      '업데이트가 지정된 시간 안에 끝나지 않았어요. 네트워크 상태를 확인해 주세요.'
    )
  }
  if (code !== 0) throw new Error(log || `yt-dlp -U exit ${code}`)
  const after = await tryGetVersion()
  // 전후 버전을 모두 확인했고 서로 다를 때만 재시작한다. 이미 최신이면 재시작하지 않는다.
  const updated = before !== '?' && after !== '?' && before !== after
  return {
    beforeVersion: before,
    afterVersion: after,
    log,
    restart: updated ? restartToApplyUpdate() : 'none'
  }
}

export function registerUpdaterIpc(): void {
  // 앱 시작 시 yt-dlp 바이너리 워밍업 (macOS Gatekeeper, cold start 지연 완화)
  getVersion().catch(() => {
    /* 워밍업 실패는 무시 — 이후 실제 호출에서 에러 처리 */
  })

  // 앱 업데이트와 같은 주기(시작 시 + 6시간마다)로 yt-dlp도 자동 확인한다.
  // 실패는 무시하고 다음 주기에 재시도한다.
  const autoUpdate = (): void => {
    update().catch((e) => {
      console.warn('[updater] 자동 업데이트 확인 실패', e)
    })
  }
  autoUpdate()
  setInterval(autoUpdate, AUTO_UPDATE_INTERVAL_MS)

  ipcMain.handle('ytdlp:version', async () => {
    // yt-dlp -U가 바이너리를 교체하는 도중에 실행하면 깨진 실행 파일을 그대로
    // 실행하게 돼 파이썬 트레이스백이 노출될 수 있다. 진행 중이면 조회를 미룬다.
    if (inFlightUpdate) {
      return {
        ok: false as const,
        error: 'yt-dlp 업데이트 중이에요. 잠시 후 다시 확인해 주세요.'
      }
    }
    try {
      return { ok: true as const, version: await getVersion() }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('ytdlp:update', async () => {
    try {
      return { ok: true as const, ...(await update()) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })
}
