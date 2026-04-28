import { BrowserWindow, ipcMain } from 'electron'
import { runYtDlpOnce } from './runner'

const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000

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

export async function update(): Promise<{
  beforeVersion: string
  afterVersion: string
  log: string
}> {
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
  return { beforeVersion: before, afterVersion: after, log }
}

export function registerUpdaterIpc(): void {
  // 앱 시작 시 yt-dlp 바이너리 워밍업 (macOS Gatekeeper, cold start 지연 완화)
  getVersion().catch(() => {
    /* 워밍업 실패는 무시 — 이후 실제 호출에서 에러 처리 */
  })

  ipcMain.handle('ytdlp:version', async () => {
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
