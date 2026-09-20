# 업데이트 후 자동 재시작 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** yt-dlp 업데이트와 앱 업데이트가 끝나면 진행 중인 다운로드가 모두 끝난 뒤 앱이 자동으로 종료됐다가 재시작되게 한다.

**Architecture:** 메인 프로세스에 재시작 스케줄러를 하나 두고, 다운로드 큐가 비는 순간 저장해 둔 재시작을 한 번만 실행한다. 스케줄러는 큐에 의존하지 않는 순수 로직(`restartScheduler.ts`)과 큐를 연결하는 얇은 모듈(`restart.ts`)로 나눠, 순수 로직을 Electron 없이 검증한다. 재시작 대기 중에는 새 다운로드 시작을 기존 `download:error` 경로로 차단한다.

**Tech Stack:** Electron 메인 프로세스(TypeScript), electron-updater, React 19 + zustand(렌더러). 테스트 러너가 없는 프로젝트이므로 순수 로직은 Node 내장 `node --test`로 임시 검증하고, 나머지는 `npm run typecheck`와 패키징 빌드 수동 시나리오로 검증한다.

**스펙:** `docs/superpowers/specs/2026-09-21-auto-restart-after-update-design.md`

---

## 작업 전 알아둘 것

- **브랜치:** `feat/auto-restart-after-update` (이미 생성됨, 스펙 커밋 포함). `main`에서 작업하지 않는다.
- **커밋 규칙** (`CONTRIBUTING.md`): `<type>: <한국어 요약>`, 마침표 없음, scope 없음. 본문에는 "왜"를 적는다. 모든 커밋 메시지 끝에 아래 줄을 붙인다.

  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

- **포맷:** 기존 파일 중 일부(`queue.ts`, `download.ts` 등)는 Prettier 규칙(`singleQuote`, `semi: false`, `trailingComma: none`)을 따르지 않는다. 기존 파일에는 `prettier --write`를 돌리지 말고 **주변 스타일에 맞춰** 수정한다. 새 파일(`restartScheduler.ts`, `restart.ts`)만 Prettier 규칙을 따른다.
- **lint 기준선:** 저장소 전체에 기존 오류 17건·경고 42건이 있다. "lint 통과"가 아니라 **수정한 파일의 문제 수가 기준선보다 늘지 않는 것**을 기준으로 삼는다. 기준선(오류/경고):

  | 파일                                            | 오류 | 경고 |
  | ----------------------------------------------- | ---- | ---- |
  | `src/main/ipc/appUpdater.ts`                    | 0    | 2    |
  | `src/main/ipc/download.ts`                      | 0    | 3    |
  | `src/main/ytdlp/queue.ts`                       | 0    | 3    |
  | `src/main/ytdlp/updater.ts`                     | 0    | 1    |
  | `src/preload/index.ts`                          | 0    | 5    |
  | `src/renderer/src/components/SettingsPanel.tsx` | 1    | 1    |
  | `src/renderer/src/components/UpdatePill.tsx`    | 0    | 0    |
  | `src/renderer/src/stores/appUpdateStore.ts`     | 0    | 0    |

- **typecheck 기준선:** `npm run typecheck`는 현재 오류 없이 통과한다.
- 스크래치 테스트 파일 경로(커밋하지 않음): `/private/tmp/claude-501/-Users-mz01-suujin-side-video-downloader/0860be5a-dbd5-42f8-b113-e58c5c821d56/scratchpad/restartScheduler.test.ts`

## 스펙과 달라진 점

구현 계획을 세우며 스펙에서 아래 세 가지를 조정했다.

1. **`restartScheduler.ts` 분리.** 스펙은 `restart.ts` 한 파일이었다. 큐(→ `downloader.ts` → `electron`)를 import하면 Node 단독으로 로직을 검증할 수 없어서, 순수 로직을 `restartScheduler.ts`로 빼고 `restart.ts`는 큐와 연결만 한다. 외부에서 쓰는 API(`requestRestart`, `isRestartPending`)는 스펙과 같다.
2. **`isIdle()` 추가.** 스펙은 `getQueueSnapshot()` 재사용이었다. `drain()` 안에서도 같은 판정이 필요해서 `queue.ts`에 `isIdle()`을 두고 양쪽에서 쓴다.
3. **수동 설치 IPC 제거.** 스펙 4번은 `app-update:quit-and-install` 핸들러를 남기라고 했다. 이 계획에서는 UI의 설치 버튼(UpdatePill, 설정 패널)이 모두 사라지므로 호출하는 곳이 없어진다. 이번 변경으로 고아가 되는 코드이므로 핸들러, preload 항목, 스토어의 `install`을 함께 제거한다.

또한 `CHANGELOG.md`는 이번 계획에서 수정하지 않는다. 버전 번호는 릴리즈 커밋에서 정해지고 `scripts/release-notes.mjs`가 `package.json` 버전과 같은 섹션을 찾기 때문이다. 넣을 문구는 문서 맨 아래 "릴리즈 시 CHANGELOG에 넣을 문구"에 적어 둔다.

## 파일 구조

| 파일                                            | 변경 | 책임                                                                                   |
| ----------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `src/main/restartScheduler.ts`                  | 신규 | 큐 상태를 주입받아 재시작 요청/대기/실행을 관리하는 순수 로직                          |
| `src/main/restart.ts`                           | 신규 | 실제 큐를 주입해 만든 스케줄러 싱글턴. `requestRestart`, `isRestartPending`을 내보낸다 |
| `src/main/ytdlp/queue.ts`                       | 수정 | `onIdle`, `isIdle` 추가. `drain()` 끝에서 유휴 알림                                    |
| `src/main/ipc/download.ts`                      | 수정 | 재시작 대기 중이면 `download:start` 차단                                               |
| `src/main/ytdlp/updater.ts`                     | 수정 | 버전이 바뀌면 재시작 요청, 반환값에 `restart` 추가                                     |
| `src/main/ipc/appUpdater.ts`                    | 수정 | `installDownloadedUpdate()` 분리, 다운로드 완료 시 자동 요청, 수동 IPC 제거            |
| `src/preload/index.ts`                          | 수정 | `UpdateResult`에 `restart` 추가, `appUpdateQuitAndInstall` 제거                        |
| `src/renderer/src/stores/appUpdateStore.ts`     | 수정 | 미사용이 된 `install` 제거                                                             |
| `src/renderer/src/components/UpdatePill.tsx`    | 수정 | `downloaded` 상태를 버튼에서 상태 표시로 변경                                          |
| `src/renderer/src/components/SettingsPanel.tsx` | 수정 | 앱 업데이트 버튼 상태·문구 변경, yt-dlp 업데이트 결과 문구에 재시작 안내 추가          |

---

### Task 1: 재시작 스케줄러 순수 로직

**Files:**

- Create: `src/main/restartScheduler.ts`
- Test (커밋하지 않음): `/private/tmp/claude-501/-Users-mz01-suujin-side-video-downloader/0860be5a-dbd5-42f8-b113-e58c5c821d56/scratchpad/restartScheduler.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

아래 내용을 스크래치 경로에 저장한다. 저장소 안에는 두지 않는다.

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRestartScheduler } from '/Users/mz01-suujin/side/video-downloader/src/main/restartScheduler.ts'

function setup(initiallyBusy: boolean) {
  let busy = initiallyBusy
  const listeners: Array<() => void> = []
  const scheduler = createRestartScheduler({
    isBusy: () => busy,
    onIdle: (listener) => {
      listeners.push(listener)
    }
  })
  return {
    scheduler,
    becomeIdle: () => {
      busy = false
      listeners.forEach((l) => l())
    }
  }
}

test('큐가 비어 있으면 즉시 실행하고 대기 상태를 유지한다', () => {
  const { scheduler } = setup(false)
  let calls = 0
  const result = scheduler.requestRestart('ytdlp-update', () => {
    calls++
    return true
  })
  assert.equal(result, 'now')
  assert.equal(calls, 1)
  assert.equal(scheduler.isRestartPending(), true)
})

test('run이 false를 반환하면 대기 상태를 해제한다', () => {
  const { scheduler } = setup(false)
  scheduler.requestRestart('app-update', () => false)
  assert.equal(scheduler.isRestartPending(), false)
})

test('run이 예외를 던져도 전파하지 않고 대기 상태를 해제한다', () => {
  const { scheduler } = setup(false)
  assert.doesNotThrow(() => {
    scheduler.requestRestart('app-update', () => {
      throw new Error('boom')
    })
  })
  assert.equal(scheduler.isRestartPending(), false)
})

test('큐가 바쁘면 미루고, 비는 순간 한 번만 실행한다', () => {
  const { scheduler, becomeIdle } = setup(true)
  let calls = 0
  const result = scheduler.requestRestart('ytdlp-update', () => {
    calls++
    return true
  })
  assert.equal(result, 'deferred')
  assert.equal(calls, 0)
  assert.equal(scheduler.isRestartPending(), true)

  becomeIdle()
  assert.equal(calls, 1)
  becomeIdle()
  assert.equal(calls, 1)
  assert.equal(scheduler.isRestartPending(), true)
})

test('미룬 run이 false를 반환하면 대기 상태를 해제한다', () => {
  const { scheduler, becomeIdle } = setup(true)
  scheduler.requestRestart('app-update', () => false)
  assert.equal(scheduler.isRestartPending(), true)
  becomeIdle()
  assert.equal(scheduler.isRestartPending(), false)
})

test('대기 중 앱 업데이트가 yt-dlp 요청보다 우선한다', () => {
  const { scheduler, becomeIdle } = setup(true)
  const calls: string[] = []
  scheduler.requestRestart('ytdlp-update', () => {
    calls.push('ytdlp')
    return true
  })
  const second = scheduler.requestRestart('app-update', () => {
    calls.push('app')
    return true
  })
  assert.equal(second, 'deferred')
  becomeIdle()
  assert.deepEqual(calls, ['app'])
})

test('대기 중 yt-dlp 요청은 앞선 앱 업데이트 요청을 대체하지 않는다', () => {
  const { scheduler, becomeIdle } = setup(true)
  const calls: string[] = []
  scheduler.requestRestart('app-update', () => {
    calls.push('app')
    return true
  })
  scheduler.requestRestart('ytdlp-update', () => {
    calls.push('ytdlp')
    return true
  })
  becomeIdle()
  assert.deepEqual(calls, ['app'])
})

test('이미 실행된 뒤의 요청은 무시하고 now를 반환한다', () => {
  const { scheduler } = setup(false)
  let second = 0
  scheduler.requestRestart('ytdlp-update', () => true)
  const result = scheduler.requestRestart('app-update', () => {
    second++
    return true
  })
  assert.equal(result, 'now')
  assert.equal(second, 0)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && node --experimental-strip-types --test /private/tmp/claude-501/-Users-mz01-suujin-side-video-downloader/0860be5a-dbd5-42f8-b113-e58c5c821d56/scratchpad/restartScheduler.test.ts
```

Expected: FAIL. `ERR_MODULE_NOT_FOUND`(`restartScheduler.ts`를 찾을 수 없음)로 종료 코드가 0이 아니다.

- [ ] **Step 3: 최소 구현 작성**

`src/main/restartScheduler.ts`를 만든다.

```ts
export type RestartReason = 'app-update' | 'ytdlp-update'

export interface RestartSchedulerDeps {
  isBusy: () => boolean
  onIdle: (listener: () => void) => void
}

interface QueuedRestart {
  reason: RestartReason
  run: () => boolean
}

// 큐가 비기를 기다렸다가 재시작을 한 번만 실행한다.
// run은 재시작을 시작했으면 true, 시작하지 못했으면 false를 반환한다.
export function createRestartScheduler(deps: RestartSchedulerDeps): {
  requestRestart: (reason: RestartReason, run: () => boolean) => 'now' | 'deferred'
  isRestartPending: () => boolean
} {
  // 요청 시점부터 실제 종료 시점까지 true. 성공하면 프로세스가 곧 종료되므로 해제하지 않는다.
  let pending = false
  // 큐가 빌 때까지 미뤄 둔 요청. run이 실행되면 null이 된다.
  let queued: QueuedRestart | null = null

  const execute = (req: QueuedRestart): void => {
    queued = null
    let started = false
    try {
      started = req.run()
    } catch (e) {
      console.error('[restart] 재시작 실행 실패', e)
    }
    if (!started) pending = false
  }

  deps.onIdle(() => {
    if (queued) execute(queued)
  })

  return {
    isRestartPending: () => pending,
    requestRestart: (reason, run) => {
      // 이미 실행 단계에 들어간 뒤의 요청은 무시한다.
      if (pending && !queued) return 'now'
      if (queued) {
        // 앱 업데이트는 어차피 프로세스를 재시작하므로 yt-dlp 요청보다 우선한다.
        if (reason === 'app-update' && queued.reason !== 'app-update') queued = { reason, run }
        return 'deferred'
      }
      pending = true
      const req = { reason, run }
      if (deps.isBusy()) {
        queued = req
        return 'deferred'
      }
      execute(req)
      return 'now'
    }
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: Step 2와 같은 명령.

Expected: 8개 테스트가 모두 `ok`이고 `# pass 8`, `# fail 0`으로 종료 코드 0.

- [ ] **Step 5: 타입체크와 포맷 확인**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && npm run typecheck:node && npx prettier --check src/main/restartScheduler.ts
```

Expected: `tsc`가 오류 없이 끝나고 `All matched files use Prettier code style!`가 출력된다. Prettier가 경고하면 `npx prettier --write src/main/restartScheduler.ts`로 고친 뒤 Step 4를 다시 실행한다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/mz01-suujin/side/video-downloader && git add src/main/restartScheduler.ts && git commit -m "$(cat <<'EOF'
feat: 재시작 스케줄러 추가

다운로드 도중 앱이 종료되면 yt-dlp가 고아 프로세스로 남는다. 큐가
빈 뒤에만 재시작하도록 요청·대기·실행을 관리하는 로직을 큐와 분리된
순수 함수로 만들어 Electron 없이 검증할 수 있게 했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 큐 유휴 알림과 스케줄러 연결

**Files:**

- Modify: `src/main/ytdlp/queue.ts:17`, `src/main/ytdlp/queue.ts:22-26`, `src/main/ytdlp/queue.ts:68-70`
- Create: `src/main/restart.ts`

- [ ] **Step 1: 유휴 리스너 저장소 추가**

`src/main/ytdlp/queue.ts`에서 아래를 찾아

```ts
let maxConcurrent = 3
```

다음으로 바꾼다.

```ts
let maxConcurrent = 3
const idleListeners: Array<() => void> = []
```

- [ ] **Step 2: `onIdle`, `isIdle` 추가**

같은 파일에서 아래를 찾아

```ts
export function getMaxConcurrent(): number {
  return maxConcurrent
}
```

다음으로 바꾼다.

```ts
export function getMaxConcurrent(): number {
  return maxConcurrent
}

// 진행 중·대기 중인 다운로드가 모두 없어질 때마다 호출된다.
export function onIdle(listener: () => void): void {
  idleListeners.push(listener)
}

export function isIdle(): boolean {
  return active.size === 0 && waiting.length === 0
}
```

- [ ] **Step 3: `drain()` 끝에서 유휴 알림**

같은 파일에서 아래를 찾아

```ts
    startDownload(entry.options, wrapped)
  }
}
```

다음으로 바꾼다.

```ts
    startDownload(entry.options, wrapped)
  }

  if (isIdle()) idleListeners.forEach((listener) => listener())
}
```

이 위치가 맞는 이유: 다운로드가 정상 종료, 실패, 취소 중 어떤 경로로 끝나도 `wrapped.onComplete`/`wrapped.onError`가 `active.delete` 후 `drain()`을 호출한다. (`downloader.ts`의 `proc.on('close')`와 `proc.on('error')`가 항상 `onComplete`나 `onError`를 부른다.)

- [ ] **Step 4: 스케줄러 싱글턴 작성**

`src/main/restart.ts`를 만든다.

```ts
import { createRestartScheduler } from './restartScheduler'
import { isIdle, onIdle } from './ytdlp/queue'

const scheduler = createRestartScheduler({ isBusy: () => !isIdle(), onIdle })

export const { requestRestart, isRestartPending } = scheduler
```

- [ ] **Step 5: 타입체크와 포맷 확인**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && npm run typecheck:node && npx prettier --check src/main/restart.ts
```

Expected: `tsc` 오류 없음, `All matched files use Prettier code style!`.

- [ ] **Step 6: 커밋**

```bash
cd /Users/mz01-suujin/side/video-downloader && git add src/main/ytdlp/queue.ts src/main/restart.ts && git commit -m "$(cat <<'EOF'
feat: 다운로드 큐 유휴 알림과 재시작 스케줄러 연결

큐가 비는 시점을 스케줄러가 알 수 있게 onIdle/isIdle을 추가하고,
실제 큐를 주입한 스케줄러 싱글턴을 restart.ts로 노출했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 재시작 대기 중 새 다운로드 차단

**Files:**

- Modify: `src/main/ipc/download.ts:7`, `src/main/ipc/download.ts:56-61`

- [ ] **Step 1: import 추가**

`src/main/ipc/download.ts`에서 아래를 찾아

```ts
import { resolveOutputDir } from './settings'
```

다음으로 바꾼다.

```ts
import { resolveOutputDir } from './settings'
import { isRestartPending } from '../restart'
```

- [ ] **Step 2: 차단 로직 추가**

같은 파일에서 아래를 찾아

```ts
    const send = (channel: string, payload: unknown): void => {
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
    }

    enqueue({
```

다음으로 바꾼다.

```ts
    const send = (channel: string, payload: unknown): void => {
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
    }

    // 업데이트 적용을 위한 재시작을 기다리는 중이면 새 다운로드를 받지 않는다.
    if (isRestartPending()) {
      const error = '업데이트 적용을 위해 재시작 대기 중이라 다운로드를 시작할 수 없어요'
      send('download:error', { id: opts.id, error })
      return { ok: false as const, error }
    }

    enqueue({
```

렌더러는 이 `download:error`를 받으면 해당 항목을 `failed` 상태와 오류 문구로 표시한다(`useDownloadEvents.ts`). `startDownload` 호출부는 반환값을 쓰지 않고 preload 시그니처도 타입이 없는 `invoke`라서 렌더러와 preload는 수정하지 않는다.

- [ ] **Step 3: 타입체크**

Run: `cd /Users/mz01-suujin/side/video-downloader && npm run typecheck`

Expected: 오류 없이 종료.

- [ ] **Step 4: 커밋**

```bash
cd /Users/mz01-suujin/side/video-downloader && git add src/main/ipc/download.ts && git commit -m "$(cat <<'EOF'
feat: 재시작 대기 중 새 다운로드 차단

재시작을 기다리는 동안 새 다운로드가 들어오면 재시작이 계속 밀리고,
종료 시 고아 프로세스가 생긴다. 기존 download:error 경로로 실패
처리해 렌더러 변경 없이 재시도할 수 있게 했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: yt-dlp 업데이트 후 자동 재시작

**Files:**

- Modify: `src/main/ytdlp/updater.ts:1-2`, `src/main/ytdlp/updater.ts:5`, `src/main/ytdlp/updater.ts:30-51`
- Modify: `src/preload/index.ts:95-97`
- Modify: `src/renderer/src/components/SettingsPanel.tsx:192-202`

- [ ] **Step 1: import와 상수 추가**

`src/main/ytdlp/updater.ts`에서 아래를 찾아

```ts
import { BrowserWindow, ipcMain } from 'electron'
import { runYtDlpOnce } from './runner'

const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000
```

다음으로 바꾼다.

```ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { requestRestart } from '../restart'
import { runYtDlpOnce } from './runner'

const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000
const RESTART_DELAY_MS = 1_500
```

- [ ] **Step 2: 재시작 요청 함수와 `update()` 반환값 수정**

같은 파일에서 아래를 찾아

```ts
export async function update(): Promise<{
  beforeVersion: string
  afterVersion: string
  log: string
}> {
```

다음으로 바꾼다.

```ts
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

export async function update(): Promise<{
  beforeVersion: string
  afterVersion: string
  log: string
  restart: RestartMode
}> {
```

같은 파일에서 아래를 찾아

```ts
  const after = await tryGetVersion()
  return { beforeVersion: before, afterVersion: after, log }
}
```

다음으로 바꾼다.

```ts
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
```

- [ ] **Step 3: preload 타입에 `restart` 추가**

`src/preload/index.ts`에서 아래를 찾아

```ts
export type UpdateResult =
  | { ok: true; beforeVersion: string; afterVersion: string; log: string }
  | { ok: false; error: string }
```

다음으로 바꾼다.

```ts
export type UpdateResult =
  | {
      ok: true
      beforeVersion: string
      afterVersion: string
      log: string
      restart: 'now' | 'deferred' | 'none'
    }
  | { ok: false; error: string }
```

- [ ] **Step 4: 설정 패널 결과 문구에 재시작 안내 추가**

`src/renderer/src/components/SettingsPanel.tsx`에서 아래를 찾아

```tsx
const b = r.beforeVersion
const a = r.afterVersion
setUpdateMsg(
  a === '?'
    ? '업데이트 완료 (버전 확인 실패)'
    : b === a
      ? `이미 최신 버전입니다 (${a})`
      : `${b} → ${a} 업데이트 완료`
)
```

다음으로 바꾼다.

```tsx
const b = r.beforeVersion
const a = r.afterVersion
const restartNote =
  r.restart === 'now'
    ? ' — 잠시 후 재시작합니다'
    : r.restart === 'deferred'
      ? ' — 다운로드가 끝나면 재시작합니다'
      : ''
setUpdateMsg(
  a === '?'
    ? '업데이트 완료 (버전 확인 실패)'
    : b === a
      ? `이미 최신 버전입니다 (${a})`
      : `${b} → ${a} 업데이트 완료${restartNote}`
)
```

- [ ] **Step 5: 타입체크**

Run: `cd /Users/mz01-suujin/side/video-downloader && npm run typecheck`

Expected: `typecheck:node`와 `typecheck:web` 모두 오류 없이 종료. (`r.restart`는 `UpdateResult`의 `ok: true` 분기에서만 접근하므로 타입 오류가 없어야 한다.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/mz01-suujin/side/video-downloader && git add src/main/ytdlp/updater.ts src/preload/index.ts src/renderer/src/components/SettingsPanel.tsx && git commit -m "$(cat <<'EOF'
feat: yt-dlp 업데이트 후 자동 재시작

yt-dlp를 업데이트한 뒤 앱을 재시작하지 않으면 오류가 발생한다.
버전이 실제로 바뀐 경우에만 다운로드가 끝난 뒤 재시작하고, 개발
모드에서는 건너뛴다. 설정 패널에는 재시작 예정 여부를 안내한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 앱 업데이트 다운로드 완료 시 자동 재시작

**Files:**

- Modify: `src/main/ipc/appUpdater.ts:7`, `src/main/ipc/appUpdater.ts:118-135`, `src/main/ipc/appUpdater.ts:157-172`
- Modify: `src/preload/index.ts:162`
- Modify: `src/renderer/src/stores/appUpdateStore.ts:21`, `src/renderer/src/stores/appUpdateStore.ts:107-111`
- Modify: `src/renderer/src/components/UpdatePill.tsx`
- Modify: `src/renderer/src/components/SettingsPanel.tsx:144-147`, `src/renderer/src/components/SettingsPanel.tsx:164-168`, `src/renderer/src/components/SettingsPanel.tsx:458-472`

- [ ] **Step 1: `appUpdater.ts` import 추가**

`src/main/ipc/appUpdater.ts`에서 아래를 찾아

```ts
import { setLastReleaseNotes } from './settings'
```

다음으로 바꾼다.

```ts
import { setLastReleaseNotes } from './settings'
import { requestRestart } from '../restart'
```

- [ ] **Step 2: 설치 로직을 `installDownloadedUpdate()`로 분리**

같은 파일에서 아래를 찾아

```ts
export function registerAppUpdaterIpc(): void {
  autoUpdater.on('checking-for-update', () => send('app-update:checking'))
```

다음으로 바꾼다.

```ts
// ad-hoc 서명 환경에선 Squirrel 자동 설치가 검증 실패하므로,
// 외부 셸 스크립트가 앱 종료 후 /Applications/Dovvn.app을 새 버전으로 덮어쓰고 재실행한다.
// 교체를 시작했으면 true, 업데이트 파일을 준비하지 못했으면 false를 반환한다.
function installDownloadedUpdate(): boolean {
  if (!downloadedFile) {
    autoUpdater.quitAndInstall()
    return true
  }
  const newAppPath = prepareNewApp(downloadedFile)
  if (!newAppPath) {
    send('app-update:error', '업데이트 파일을 준비하지 못했어요. 잠시 후 다시 시도해주세요.')
    return false
  }
  const pendingDir = path.dirname(downloadedFile)
  runReplaceScript(newAppPath, pendingDir)
  setTimeout(() => app.quit(), 300)
  return true
}

export function registerAppUpdaterIpc(): void {
  autoUpdater.on('checking-for-update', () => send('app-update:checking'))
```

- [ ] **Step 3: 다운로드 완료 시 자동으로 재시작 요청**

같은 파일에서 아래를 찾아

```ts
    send('app-update:downloaded', info)
  })
```

다음으로 바꾼다.

```ts
    send('app-update:downloaded', info)
    // 진행 중인 다운로드가 있으면 끝난 뒤에, 없으면 바로 재시작한다.
    requestRestart('app-update', installDownloadedUpdate)
  })
```

- [ ] **Step 4: 수동 설치 IPC 핸들러 제거**

같은 파일에서 아래를 찾아

```ts
      return { ok: false as const, error: String((e as Error).message ?? e) }
    }
  })

  // ad-hoc 서명 환경에선 Squirrel 자동 설치가 검증 실패하므로,
  // 외부 셸 스크립트가 앱 종료 후 /Applications/Dovvn.app을 새 버전으로 덮어쓰고 재실행한다.
  ipcMain.handle('app-update:quit-and-install', () => {
    if (!downloadedFile) {
      autoUpdater.quitAndInstall()
      return
    }
    const newAppPath = prepareNewApp(downloadedFile)
    if (!newAppPath) {
      send('app-update:error', '업데이트 파일을 준비하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    const pendingDir = path.dirname(downloadedFile)
    runReplaceScript(newAppPath, pendingDir)
    setTimeout(() => app.quit(), 300)
  })
}
```

다음으로 바꾼다.

```ts
      return { ok: false as const, error: String((e as Error).message ?? e) }
    }
  })
}
```

이 `old_string`은 파일 끝부분 전체이므로 그대로 붙여 넣어야 유일하게 매칭된다. `app-update:download` 핸들러의 `catch` 블록이 바로 위에 있다.

- [ ] **Step 5: preload에서 `appUpdateQuitAndInstall` 제거**

`src/preload/index.ts`에서 아래를 찾아

```ts
  appUpdateQuitAndInstall: () => ipcRenderer.invoke('app-update:quit-and-install'),
```

이 줄을 통째로 삭제한다. (앞뒤 줄은 그대로 둔다.)

- [ ] **Step 6: 스토어에서 미사용 `install` 제거**

`src/renderer/src/stores/appUpdateStore.ts`에서 아래를 찾아

```ts
  download: () => Promise<void>
  install: () => void
}
```

다음으로 바꾼다.

```ts
  download: () => Promise<void>
}
```

같은 파일에서 아래를 찾아

```ts
  },

  install: () => {
    window.api.appUpdateQuitAndInstall()
  }
}))
```

다음으로 바꾼다.

```ts
  }
}))
```

- [ ] **Step 7: `UpdatePill`을 상태 표시로 변경**

`src/renderer/src/components/UpdatePill.tsx` 전체를 아래로 바꾼다.

```tsx
import { RefreshCw } from 'lucide-react'
import { useAppUpdateStore } from '../stores/appUpdateStore'

export function UpdatePill(): React.JSX.Element | null {
  const phase = useAppUpdateStore((s) => s.phase)

  if (
    phase === 'checking' ||
    phase === 'available' ||
    phase === 'downloading' ||
    phase === 'downloaded'
  ) {
    return (
      <div className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-[color:var(--color-ghost-muted)] bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)]">
        <RefreshCw size={11} className="animate-spin" />
        {phase === 'downloaded' ? '재시작 대기 중…' : '버전 확인 중…'}
      </div>
    )
  }

  return null
}
```

기존 `downloaded` 버튼과 `ArrowUpCircle` import, `install` 셀렉터가 사라진다.

- [ ] **Step 8: 설정 패널 앱 업데이트 영역 수정**

`src/renderer/src/components/SettingsPanel.tsx`에서 세 군데를 고친다.

(a) 아래를 찾아

```tsx
window.api.onAppUpdateDownloaded((info) => {
  setAppUpdateState('downloaded')
  setAppUpdateMsg(`버전 ${info.version} 설치 준비 완료`)
})
```

다음으로 바꾼다.

```tsx
window.api.onAppUpdateDownloaded((info) => {
  setAppUpdateState('downloaded')
  setAppUpdateMsg(`버전 ${info.version} 준비 완료 — 곧 자동으로 재시작합니다`)
})
```

(b) 아래를 찾아

```tsx
  const doAppUpdate = async (): Promise<void> => {
    if (appUpdateState === 'downloaded') {
      window.api.appUpdateQuitAndInstall()
      return
    }
    setAppUpdateState('checking')
```

다음으로 바꾼다.

```tsx
  const doAppUpdate = async (): Promise<void> => {
    setAppUpdateState('checking')
```

(c) 아래를 찾아

```tsx
<button
  onClick={doAppUpdate}
  disabled={appUpdateState === 'checking'}
  className="btn-soft text-xs px-3 py-1.5"
>
  <RefreshCw size={12} className={appUpdateState === 'checking' ? 'animate-spin' : ''} />
  {appUpdateState === 'checking'
    ? '확인 중'
    : appUpdateState === 'downloaded'
      ? '재시작하여 설치'
      : '업데이트 확인'}
</button>
```

다음으로 바꾼다.

```tsx
<button
  onClick={doAppUpdate}
  disabled={appUpdateState !== 'idle'}
  className="btn-soft text-xs px-3 py-1.5"
>
  <RefreshCw size={12} className={appUpdateState === 'checking' ? 'animate-spin' : ''} />
  {appUpdateState === 'checking'
    ? '확인 중'
    : appUpdateState === 'downloaded'
      ? '재시작 대기 중'
      : '업데이트 확인'}
</button>
```

- [ ] **Step 9: 남은 참조가 없는지 확인하고 타입체크**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && grep -rn "appUpdateQuitAndInstall\|app-update:quit-and-install\|ArrowUpCircle" src; echo "grep exit=$?"; npm run typecheck
```

Expected: `grep`은 아무것도 출력하지 않고 `grep exit=1`, 이어서 `typecheck:node`와 `typecheck:web`이 오류 없이 종료.

- [ ] **Step 10: 커밋**

```bash
cd /Users/mz01-suujin/side/video-downloader && git add src/main/ipc/appUpdater.ts src/preload/index.ts src/renderer/src/stores/appUpdateStore.ts src/renderer/src/components/UpdatePill.tsx src/renderer/src/components/SettingsPanel.tsx && git commit -m "$(cat <<'EOF'
feat: 앱 업데이트 다운로드 완료 시 자동 재시작

다운로드가 끝나도 사용자가 설치 버튼을 눌러야 재시작되던 것을, 다운로드가
없으면 바로, 있으면 끝난 뒤에 자동으로 재시작하도록 바꿨다. 설치 버튼이
사라지므로 호출하는 곳이 없어진 수동 설치 IPC, preload 항목, 스토어의
install도 함께 제거했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 전체 검증

**Files:** 변경 없음 (검증만).

- [ ] **Step 1: 타입체크**

Run: `cd /Users/mz01-suujin/side/video-downloader && npm run typecheck`

Expected: 오류 없이 종료 (기준선과 같음).

- [ ] **Step 2: 수정 파일별 lint가 기준선보다 늘지 않았는지 확인**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && npx eslint --no-cache -f json src/main/restartScheduler.ts src/main/restart.ts src/main/ytdlp/queue.ts src/main/ytdlp/updater.ts src/main/ipc/appUpdater.ts src/main/ipc/download.ts src/preload/index.ts src/renderer/src/components/UpdatePill.tsx src/renderer/src/components/SettingsPanel.tsx src/renderer/src/stores/appUpdateStore.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected (기준선 이하):

```
src/main/ipc/appUpdater.ts errors=0 warnings=2
src/main/ipc/download.ts errors=0 warnings=3
src/main/restart.ts errors=0 warnings=0
src/main/restartScheduler.ts errors=0 warnings=0
src/main/ytdlp/queue.ts errors=0 warnings=3
src/main/ytdlp/updater.ts errors=0 warnings=1
src/preload/index.ts errors=0 warnings=5
src/renderer/src/components/SettingsPanel.tsx errors=1 warnings=1
src/renderer/src/components/UpdatePill.tsx errors=0 warnings=0
src/renderer/src/stores/appUpdateStore.ts errors=0 warnings=0
```

파일 출력 순서는 달라질 수 있다. 어떤 파일이든 기준선보다 오류나 경고가 늘었으면 새로 늘어난 항목만 골라 고친다. 기존 항목은 건드리지 않는다. (`updater.ts`나 `download.ts`의 `console.log`류 규칙 경고가 새로 생기면 주변 코드 스타일에 맞춰 조정한다.)

- [ ] **Step 3: 새 파일 포맷과 스케줄러 테스트 재실행**

Run:

```bash
cd /Users/mz01-suujin/side/video-downloader && npx prettier --check src/main/restartScheduler.ts src/main/restart.ts docs/superpowers/plans/2026-09-21-auto-restart-after-update.md && node --experimental-strip-types --test /private/tmp/claude-501/-Users-mz01-suujin-side-video-downloader/0860be5a-dbd5-42f8-b113-e58c5c821d56/scratchpad/restartScheduler.test.ts
```

Expected: `All matched files use Prettier code style!` 뒤에 `# pass 8`, `# fail 0`.

- [ ] **Step 4: 패키징 빌드**

Run: `cd /Users/mz01-suujin/side/video-downloader && npm run build:unpack`

Expected: `typecheck` → `electron-vite build` → `electron-builder --dir`가 오류 없이 끝나고 `dist/mac-arm64/Dovvn.app`이 생성된다. (`dist`는 gitignore 대상이다.) 확인:

```bash
ls -d /Users/mz01-suujin/side/video-downloader/dist/mac-arm64/Dovvn.app
```

- [ ] **Step 5: 테스트용으로 오래된 yt-dlp를 번들에 넣기**

버전이 바뀌어야 재시작이 일어나므로, 패키징된 앱 안의 yt-dlp를 오래된 릴리즈로 바꾼다. 저장소의 `resources/bin`은 건드리지 않고 `dist` 안의 복사본만 바꾼다.

```bash
cd /Users/mz01-suujin/side/video-downloader && APP_BIN=dist/mac-arm64/Dovvn.app/Contents/Resources/bin && OLD_TAG=$(gh release list -R yt-dlp/yt-dlp --limit 40 --json tagName -q '.[-1].tagName') && echo "old tag: $OLD_TAG" && gh release download "$OLD_TAG" -R yt-dlp/yt-dlp -p yt-dlp_macos -O "$APP_BIN/yt-dlp" --clobber && chmod +x "$APP_BIN/yt-dlp" && xattr -c "$APP_BIN/yt-dlp" && "$APP_BIN/yt-dlp" --version
```

Expected: 출력된 버전이 `2026.03.17`(현재 `resources/bin`의 버전)보다 오래된 값이다.

- [ ] **Step 6: 수동 시나리오 실행**

`open dist/mac-arm64/Dovvn.app`으로 실행하고, 시나리오마다 PID 변화를 `pgrep -x Dovvn`으로 확인한다. 설정 패널은 yt-dlp 섹션의 "업데이트 확인"을 쓴다.

| #   | 시나리오                                                                                | 기대 결과                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 다운로드 없이 yt-dlp "업데이트 확인"                                                    | 메시지에 `… 업데이트 완료 — 잠시 후 재시작합니다`가 보이고 약 2초 안에 PID가 바뀌며 앱이 다시 뜬다. 재시작 후 설정 패널의 yt-dlp 버전이 최신이다      |
| 2   | 긴 영상 다운로드를 시작한 뒤 (Step 5로 오래된 yt-dlp로 되돌린 상태에서) "업데이트 확인" | 메시지에 `다운로드가 끝나면 재시작합니다`가 보이고 다운로드가 계속된다. 다운로드가 끝나면 PID가 바뀌며 재시작된다                                     |
| 3   | 시나리오 2의 대기 중에 다른 URL로 새 다운로드 시작                                      | 새 항목이 `failed`로 표시되고 오류 문구가 `업데이트 적용을 위해 재시작 대기 중이라 다운로드를 시작할 수 없어요`이다. 진행 중인 다운로드는 영향이 없다 |
| 4   | 시나리오 1 직후 앱이 다시 뜬 상태에서 다시 "업데이트 확인"                              | `이미 최신 버전입니다 (…)`가 표시되고 PID가 바뀌지 않는다                                                                                             |
| 5   | 시나리오 2의 대기 중에 진행 중인 다운로드를 취소                                        | 취소로 큐가 비면 곧바로 재시작된다                                                                                                                    |

각 시나리오 사이에 Step 5를 다시 실행해 yt-dlp를 오래된 버전으로 되돌린다. 시나리오 1 → 4는 이어서 진행해도 된다.

- [ ] **Step 7: 앱 업데이트 자동 재시작은 로컬에서 검증할 수 없음을 확인**

앱 업데이트 경로(`update-downloaded` → `requestRestart('app-update', …)`)는 GitHub 릴리즈(`yeosujin/dovvn-release`)에 더 높은 버전이 게시돼 있어야 동작한다. 또한 자동 재시작 코드는 이 변경이 포함된 버전을 설치한 뒤 **그 다음 릴리즈**를 받을 때 처음 작동한다. 이번 계획에서는 다음으로 대체한다.

- 스케줄러 로직은 Task 1의 테스트로 검증한다. (즉시 실행, 대기 후 실행, 앱 업데이트 우선, 실패 시 해제)
- `installDownloadedUpdate()`는 기존 핸들러 본문을 그대로 옮긴 것이며, 준비 실패 시 `false`를 반환하는 점만 다르다. diff에서 이 점을 눈으로 확인한다: `git diff main -- src/main/ipc/appUpdater.ts`
- 실제 동작은 이 변경이 포함된 릴리즈 다음 버전을 낼 때 확인해야 한다.

- [ ] **Step 8: 작업 트리 확인**

Run: `cd /Users/mz01-suujin/side/video-downloader && git status --short && git log --oneline main..HEAD`

Expected: `git status`는 출력이 없다(스크래치 테스트는 저장소 밖에 있음). `git log`에는 스펙 커밋과 Task 1~5의 커밋이 순서대로 보인다.

---

## 릴리즈 시 CHANGELOG에 넣을 문구

`CONTRIBUTING.md` 규칙에 따라 릴리즈 커밋에서 새 버전 섹션(`## x.y.z`)을 만들 때 아래를 사용한다. 이번 계획에서는 `CHANGELOG.md`를 수정하지 않는다.

```markdown
- yt-dlp를 업데이트하면 다운로드가 끝난 뒤 앱이 자동으로 다시 시작돼요. 재시작하지 않으면 오류가 나던 문제를 없앴어요
- 앱 업데이트를 받으면 버튼을 누르지 않아도 다운로드가 끝난 뒤 자동으로 설치하고 다시 시작해요
- 재시작을 기다리는 동안에는 새 다운로드를 시작할 수 없어요

### 내부

- 재시작 스케줄러(`src/main/restart.ts`) 추가. 다운로드 큐가 빌 때까지 재시작을 미루고, 대기 중에는 `download:start`를 차단한다.
- 수동 설치 IPC(`app-update:quit-and-install`)와 UpdatePill의 설치 버튼 제거.
```

## 알려진 한계 (스펙과 동일)

- 앱 업데이트는 `.app` 전체를 교체하므로 `yt-dlp -U`로 올려 둔 yt-dlp가 번들 버전으로 되돌아갈 수 있다.
- 재시작 시점에 진행 중인 영상 정보 조회(`video:info`)는 끊긴다.
- 앱 업데이트 파일 준비에 실패하면 설정 패널에는 오류가 표시되고 재시작 대기가 풀리지만, 상단 `UpdatePill`은 `downloaded` 상태로 남아 "재시작 대기 중…"을 계속 표시한다(스토어가 `downloaded` 상태에서는 오류 이벤트를 무시하기 때문). 설정 패널의 "업데이트 확인"으로 다시 시도할 수 있다.
