import { app } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { getSystemCaPath } from './system-ca'

function binDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(app.getAppPath(), 'resources', 'bin')
}

export function getYtDlpPath(): string {
  return path.join(binDir(), 'yt-dlp')
}

export function getFfmpegPath(): string {
  return path.join(binDir(), 'ffmpeg')
}

export function getAria2cPath(): string {
  return path.join(binDir(), 'aria2c')
}

export function runYtDlp(args: string[]) {
  // 시스템 CA를 쓰려면 두 가지가 모두 필요하다. yt-dlp는 기본적으로 번들 certifi를
  // 먼저 로드해 SSL_CERT_FILE을 무시하므로, no-certifi로 certifi를 끄고 나서야
  // SSL_CERT_FILE이 실제로 적용된다. (사내 TLS 인터셉트 프록시 환경 대응)
  const caPath = getSystemCaPath()
  const caArgs = caPath ? ['--compat-options', 'no-certifi'] : []
  const withFfmpeg = ['--ffmpeg-location', getFfmpegPath(), ...caArgs, ...args]
  // yt-dlp는 PyInstaller로 묶인 Python 바이너리. stdout이 파이프면 Python이 블록 버퍼링을 써서
  // 진행률이 몰려 나오므로 PYTHONUNBUFFERED로 라인 버퍼링을 강제한다.
  // detached: true로 새 프로세스 그룹을 만들어 취소 시 자식(ffmpeg/aria2c)까지 한 번에 죽인다.
  return spawn(getYtDlpPath(), withFfmpeg, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      ...(caPath ? { SSL_CERT_FILE: caPath } : {}),
    },
    detached: true,
  })
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut?: boolean
}

export interface RunOptions {
  timeoutMs?: number
  onStdoutLine?: (line: string) => void
  onStderrLine?: (line: string) => void
}

function emitLines(
  buf: string,
  cb?: (line: string) => void
): { rest: string } {
  if (!cb) return { rest: buf }
  let rest = buf
  let nl: number
  while ((nl = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, nl).replace(/\r$/, '')
    rest = rest.slice(nl + 1)
    if (line.length > 0) cb(line)
  }
  return { rest }
}

export function runYtDlpOnce(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = runYtDlp(args)
    let stdout = ''
    let stderr = ''
    let stdoutLineBuf = ''
    let stderrLineBuf = ''
    let timedOut = false
    let killTimer: NodeJS.Timeout | null = null
    let forceKillTimer: NodeJS.Timeout | null = null

    const clearTimers = (): void => {
      if (killTimer) clearTimeout(killTimer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
    }

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      killTimer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
        forceKillTimer = setTimeout(() => proc.kill('SIGKILL'), 3000)
      }, opts.timeoutMs)
    }

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      if (opts.onStdoutLine) {
        stdoutLineBuf += text
        const { rest } = emitLines(stdoutLineBuf, opts.onStdoutLine)
        stdoutLineBuf = rest
      }
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      if (opts.onStderrLine) {
        stderrLineBuf += text
        const { rest } = emitLines(stderrLineBuf, opts.onStderrLine)
        stderrLineBuf = rest
      }
    })
    proc.on('error', (err) => {
      clearTimers()
      reject(err)
    })
    proc.on('close', (code) => {
      clearTimers()
      if (stdoutLineBuf.trim() && opts.onStdoutLine) opts.onStdoutLine(stdoutLineBuf.trim())
      if (stderrLineBuf.trim() && opts.onStderrLine) opts.onStderrLine(stderrLineBuf.trim())
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}
