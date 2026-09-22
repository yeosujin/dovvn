# 업데이트 통합 확인과 재시작 버튼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** yt-dlp도 앱처럼 자동으로 주기 확인하고, 둘 중 하나라도 재시작 대기 중이면 상단에 클릭 가능한 "지금 재시작" 버튼이 뜨게 한다.

**Architecture:** 메인 프로세스의 재시작 스케줄러(`restartScheduler.ts`)가 이미 갖고 있는 대기(`pending`) 상태를 IPC로 그대로 내보내, 앱 업데이트/yt-dlp 업데이트 중 무엇이 원인이든 렌더러가 하나의 신호만 보면 되게 한다. 강제 재시작은 새 IPC 없이 기존 다운로드 취소 API로 큐를 비워, 이미 검증된 자동 재시작 경로를 그대로 태운다. yt-dlp 자동 확인은 메인 프로세스 타이머로 추가한다(렌더러가 없어도 동작, 기존 워밍업 패턴과 같은 위치).

**Tech Stack:** Electron 메인 프로세스(TypeScript), electron-updater, React 19 + zustand(렌더러). 테스트 러너가 없는 프로젝트이므로 순수 로직은 Node 내장 `node --test`로 임시 검증하고, 나머지는 `npm run typecheck`와 패키징 빌드 수동 시나리오로 검증한다.

**스펙:** `docs/superpowers/specs/2026-09-22-unified-restart-button-design.md`

---

## 작업 전 알아둘 것

- **브랜치:** `feat/unified-restart-button` (이미 생성됨, 스펙 커밋 포함). `main`에서 작업하지 않는다.
- **경로 표기:** 이 문서의 `<repo>`는 이 저장소를 clone한 로컬 절대 경로, `<scratchpad>`는 실행 세션의 스크래치 디렉터리를 뜻하는 자리표시자다. 실제로 명령을 실행하거나 파일을 만들 때는 실행 중인 세션의 진짜 절대 경로로 바꿔 쓴다. (이 플레이스홀더를 쓰는 이유: 이 계획 문서 자체가 공개 저장소에 커밋되므로 로컬 사용자명 등이 노출되지 않게 하기 위해서다.)
- **커밋 규칙** (`CONTRIBUTING.md`): `<type>: <한국어 요약>`, 마침표 없음, scope 없음. 본문에는 "왜"를 적는다. 모든 커밋 메시지 끝에 아래 줄을 붙인다.

  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

- **포맷:** 아래 기존 파일은 Prettier 규칙(`singleQuote`, `semi: false`, `trailingComma: none`)을 따르지 **않는다**. 이 파일들에는 `prettier --write`를 돌리지 말고 **주변 스타일에 맞춰** 수정한다: `src/main/ytdlp/updater.ts`, `src/preload/index.ts`, `src/renderer/src/stores/downloadStore.ts`. 그 외 수정 대상 기존 파일(`src/main/restartScheduler.ts`, `src/main/restart.ts`, `src/main/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/UpdatePill.tsx`, `src/renderer/src/stores/appUpdateStore.ts`)은 이미 Prettier 규칙을 따르고 있으니 편집 후 형태가 흐트러지지 않았는지만 확인하면 된다(굳이 `--write`를 돌릴 필요는 없다). 새 파일(`src/main/ipc/restart.ts`, `src/renderer/src/stores/restartStore.ts`)은 Prettier 규칙을 따라야 하며 `prettier --write` 허용.
- **lint 기준선:** "lint 통과"가 아니라 **수정한 파일의 문제 수가 기준선보다 늘지 않는 것**을 기준으로 삼는다. 각 Task의 lint 확인 Step에서 숫자가 기준선보다 늘었다면, 새로 늘어난 항목만 자신이 추가한 줄 안에서 고치고 기존 항목은 건드리지 않는다. 기준선(오류/경고):

  | 파일                                             | 오류 | 경고 |
  | ------------------------------------------------ | ---- | ---- |
  | `src/main/restartScheduler.ts`                   | 0    | 0    |
  | `src/main/restart.ts`                            | 0    | 0    |
  | `src/main/index.ts`                              | 0    | 0    |
  | `src/main/ytdlp/updater.ts`                      | 0    | 1    |
  | `src/preload/index.ts`                           | 0    | 5    |
  | `src/renderer/src/App.tsx`                       | 4    | 0    |
  | `src/renderer/src/components/UpdatePill.tsx`     | 0    | 0    |
  | `src/renderer/src/stores/appUpdateStore.ts`      | 0    | 0    |
  | `src/renderer/src/stores/downloadStore.ts`       | 0    | 1    |
  | `src/main/ipc/restart.ts` (신규)                 | 0    | 0    |
  | `src/renderer/src/stores/restartStore.ts` (신규) | 0    | 0    |

  `App.tsx`의 기존 오류 4건은 `autoPasteStateRef` 관련(87번째 줄 부근, `react-hooks/refs`)이며 이번 작업과 무관하다. 건드리지 않는다.

- **typecheck 기준선:** `npm run typecheck`는 현재 오류 없이 통과한다.
- 스크래치 테스트 파일 경로(커밋하지 않음): `<scratchpad>/restartSchedulerPending.test.ts` (새로 만든다. 이전 기능의 스크래치 테스트 `restartScheduler.test.ts`가 세션에 남아 있어도 이 계획은 그것에 의존하지 않는다.)

## 파일 구조

| 파일                                         | 변경 | 책임                                                                       |
| -------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `src/main/restartScheduler.ts`               | 수정 | `onPendingChange` 훅 추가 — `pending`이 바뀌는 두 지점에서 호출            |
| `src/main/restart.ts`                        | 수정 | 훅을 리스너 배열로 팬아웃, `onRestartPendingChange(listener)` 내보내기     |
| `src/main/ipc/restart.ts`                    | 신규 | `restart:is-pending` 조회, `restart:pending-changed` 브로드캐스트          |
| `src/main/index.ts`                          | 수정 | `registerRestartIpc()` 등록 (다른 재시작 관련 모듈보다 먼저)               |
| `src/main/ytdlp/updater.ts`                  | 수정 | `update()` 동시 실행 방지, 시작 시 + 6시간마다 자동 확인 타이머            |
| `src/preload/index.ts`                       | 수정 | `isRestartPending`, `onRestartPendingChanged` 노출                         |
| `src/renderer/src/stores/restartStore.ts`    | 신규 | 재시작 대기 상태 + 강제 재시작(기존 다운로드 취소 API 재사용)              |
| `src/renderer/src/App.tsx`                   | 수정 | `restartStore.init()` 호출 추가                                            |
| `src/renderer/src/components/UpdatePill.tsx` | 수정 | 대기 중이면 클릭 가능한 "지금 재시작" 버튼, 아니면 기존 앱 업데이트 스피너 |

---

### Task 1: 재시작 스케줄러에 대기 상태 변경 훅 추가

**Files:**

- Modify: `src/main/restartScheduler.ts`
- Test (커밋하지 않음): `<scratchpad>/restartSchedulerPending.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

아래 내용을 스크래치 경로에 저장한다. `<repo>`는 실제 절대 경로로 바꿔 쓴다.

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRestartScheduler } from '<repo>/src/main/restartScheduler.ts'

function setup(initiallyBusy: boolean) {
  let busy = initiallyBusy
  const idleListeners: Array<() => void> = []
  const pendingCalls: boolean[] = []
  const scheduler = createRestartScheduler({
    isBusy: () => busy,
    onIdle: (listener) => {
      idleListeners.push(listener)
    },
    onPendingChange: (pending) => {
      pendingCalls.push(pending)
    }
  })
  return {
    scheduler,
    pendingCalls,
    becomeIdle: () => {
      busy = false
      idleListeners.forEach((l) => l())
    }
  }
}

test('즉시 실행되면 onPendingChange가 true로 한 번 불린다', () => {
  const { scheduler, pendingCalls } = setup(false)
  scheduler.requestRestart('ytdlp-update', () => true)
  assert.deepEqual(pendingCalls, [true])
})

test('run이 false를 반환해 해제되면 onPendingChange가 false로 한 번 더 불린다', () => {
  const { scheduler, pendingCalls } = setup(false)
  scheduler.requestRestart('app-update', () => false)
  assert.deepEqual(pendingCalls, [true, false])
})

test('run이 예외를 던져 해제될 때도 onPendingChange가 false로 불린다', () => {
  const { scheduler, pendingCalls } = setup(false)
  scheduler.requestRestart('app-update', () => {
    throw new Error('boom')
  })
  assert.deepEqual(pendingCalls, [true, false])
})

test('큐가 비어 있다가 실행될 때도 순서대로 true, false가 불린다 (대기 경로)', () => {
  const { scheduler, pendingCalls, becomeIdle } = setup(true)
  scheduler.requestRestart('app-update', () => false)
  assert.deepEqual(pendingCalls, [true])
  becomeIdle()
  assert.deepEqual(pendingCalls, [true, false])
})

test('onPendingChange 없이(deps에서 생략) 생성해도 정상 동작한다', () => {
  let busy = false
  const idleListeners: Array<() => void> = []
  const scheduler = createRestartScheduler({
    isBusy: () => busy,
    onIdle: (listener) => {
      idleListeners.push(listener)
    }
  })
  assert.doesNotThrow(() => {
    scheduler.requestRestart('ytdlp-update', () => true)
  })
  assert.equal(scheduler.isRestartPending(), true)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd <repo> && node --experimental-strip-types --test <scratchpad>/restartSchedulerPending.test.ts`

Expected: FAIL. `onPendingChange`를 deps에 넘겨도 타입 오류는 안 나지만(선택적 필드가 아직 없으므로 TS는 컴파일 시점에 걸러야 하는데, `node --experimental-strip-types`는 타입을 지우기만 하고 검사하지 않으므로) 런타임에서는 `deps.onPendingChange?.(...)` 호출이 아직 없어 `pendingCalls`가 비어 있다. 첫 번째 테스트가 `assert.deepEqual([], [true])`로 FAIL한다.

- [ ] **Step 3: 최소 구현 작성**

`src/main/restartScheduler.ts`에서 아래를 찾아

```ts
export interface RestartSchedulerDeps {
  isBusy: () => boolean
  onIdle: (listener: () => void) => void
}
```

다음으로 바꾼다.

```ts
export interface RestartSchedulerDeps {
  isBusy: () => boolean
  onIdle: (listener: () => void) => void
  onPendingChange?: (pending: boolean) => void
}
```

같은 파일에서 아래를 찾아

```ts
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
```

다음으로 바꾼다.

```ts
const execute = (req: QueuedRestart): void => {
  queued = null
  let started = false
  try {
    started = req.run()
  } catch (e) {
    console.error('[restart] 재시작 실행 실패', e)
  }
  if (!started) {
    pending = false
    deps.onPendingChange?.(false)
  }
}
```

같은 파일에서 아래를 찾아

```ts
pending = true
const req = { reason, run }
```

다음으로 바꾼다.

```ts
pending = true
deps.onPendingChange?.(true)
const req = { reason, run }
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: Step 2와 같은 명령.

Expected: 5개 테스트가 모두 `ok`이고 `# pass 5`, `# fail 0`으로 종료 코드 0. (세 번째 테스트에서 `[restart] 재시작 실행 실패 Error: boom`이 stderr에 찍히는 것은 정상이다.)

- [ ] **Step 5: 타입체크와 lint 확인**

Run:

```bash
cd <repo> && npm run typecheck:node && npx eslint --no-cache -f json src/main/restartScheduler.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `tsc` 오류 없음, `src/main/restartScheduler.ts errors=0 warnings=0` (기준선과 같음).

- [ ] **Step 6: 커밋**

```bash
cd <repo> && git add src/main/restartScheduler.ts && git commit -m "$(cat <<'EOF'
feat: 재시작 스케줄러에 대기 상태 변경 훅 추가

앱 업데이트와 yt-dlp 업데이트 중 무엇이 재시작을 요청했는지는 UI
입장에서 중요하지 않다. 실제로 다운로드를 막는 값(pending)이 바뀔
때마다 알려주는 훅을 추가해, 렌더러가 두 업데이트 상태를 따로 조합하지
않고 이 값 하나만 보면 되게 했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 메인 프로세스에서 재시작 대기 상태 IPC로 노출

**Files:**

- Modify: `src/main/restart.ts`
- Create: `src/main/ipc/restart.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: `restart.ts`에서 리스너 팬아웃**

`src/main/restart.ts` 전체를 아래로 바꾼다. (Write 도구를 쓰려면 먼저 파일을 Read 해야 한다.)

```ts
import { createRestartScheduler } from './restartScheduler'
import { isIdle, onIdle } from './ytdlp/queue'

const pendingListeners: Array<(pending: boolean) => void> = []

const scheduler = createRestartScheduler({
  isBusy: () => !isIdle(),
  onIdle,
  onPendingChange: (pending) => pendingListeners.forEach((listener) => listener(pending))
})

export const { requestRestart, isRestartPending } = scheduler

export function onRestartPendingChange(listener: (pending: boolean) => void): void {
  pendingListeners.push(listener)
}
```

- [ ] **Step 2: 새 IPC 모듈 작성**

`src/main/ipc/restart.ts`를 만든다.

```ts
import { BrowserWindow, ipcMain } from 'electron'
import { isRestartPending, onRestartPendingChange } from '../restart'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerRestartIpc(): void {
  onRestartPendingChange((pending) => broadcast('restart:pending-changed', pending))

  ipcMain.handle('restart:is-pending', () => isRestartPending())
}
```

- [ ] **Step 3: `main/index.ts`에 등록**

`src/main/index.ts`에서 아래를 찾아

```ts
import { registerDownloadIpc } from './ipc/download'
import { registerSettingsIpc, initSettings } from './ipc/settings'
import { initPresets, registerPresetsIpc } from './ipc/presets'
import { registerUpdaterIpc } from './ytdlp/updater'
import { initSystemCa } from './ytdlp/system-ca'
import { registerAppUpdaterIpc } from './ipc/appUpdater'
```

다음으로 바꾼다.

```ts
import { registerDownloadIpc } from './ipc/download'
import { registerSettingsIpc, initSettings } from './ipc/settings'
import { initPresets, registerPresetsIpc } from './ipc/presets'
import { registerUpdaterIpc } from './ytdlp/updater'
import { initSystemCa } from './ytdlp/system-ca'
import { registerAppUpdaterIpc } from './ipc/appUpdater'
import { registerRestartIpc } from './ipc/restart'
```

같은 파일에서 아래를 찾아

```ts
initSystemCa()
initSettings()
initPresets()
registerSettingsIpc()
registerPresetsIpc()
registerUpdaterIpc()
registerAppUpdaterIpc()
registerDownloadIpc()
```

다음으로 바꾼다.

```ts
initSystemCa()
initSettings()
initPresets()
registerSettingsIpc()
registerPresetsIpc()
registerRestartIpc()
registerUpdaterIpc()
registerAppUpdaterIpc()
registerDownloadIpc()
```

`registerRestartIpc()`를 `registerUpdaterIpc()`, `registerAppUpdaterIpc()`보다 먼저 두는 이유: 두 모듈 다 시작 직후 `requestRestart`를 부를 수 있는데, 대기 상태 변경 리스너가 그보다 늦게 등록되면 첫 변화를 렌더러에 못 알릴 수 있다.

- [ ] **Step 4: 타입체크와 lint 확인**

Run:

```bash
cd <repo> && npm run typecheck:node && npx eslint --no-cache -f json src/main/restart.ts src/main/ipc/restart.ts src/main/index.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `tsc` 오류 없음. 세 파일 모두 `errors=0 warnings=0` (기준선과 같음).

새 파일 포맷 확인: `npx prettier --check src/main/ipc/restart.ts` → `All matched files use Prettier code style!`. 아니면 `npx prettier --write src/main/ipc/restart.ts`로 고친다(이 새 파일에 한해서만 허용).

- [ ] **Step 5: 커밋**

```bash
cd <repo> && git add src/main/restart.ts src/main/ipc/restart.ts src/main/index.ts && git commit -m "$(cat <<'EOF'
feat: 재시작 대기 상태를 IPC로 노출

렌더러가 창을 닫았다 다시 열어도(맥OS는 창을 닫아도 프로세스가 남는다)
현재 재시작 대기 여부를 알 수 있도록 조회(restart:is-pending)와 실시간
알림(restart:pending-changed) 두 채널을 추가했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: preload에 재시작 대기 API 노출

**Files:**

- Modify: `src/preload/index.ts`

- [ ] **Step 1: api 객체에 두 항목 추가**

`src/preload/index.ts`에서 아래를 찾아

```ts
  onAppUpdateDownloaded: (cb: (info: AppUpdateInfo) => void) =>
    subscribe<AppUpdateInfo>('app-update:downloaded', cb),

  onQueued: (cb: (p: QueuedPayload) => void) => subscribe<QueuedPayload>('download:queued', cb),
```

다음으로 바꾼다.

```ts
  onAppUpdateDownloaded: (cb: (info: AppUpdateInfo) => void) =>
    subscribe<AppUpdateInfo>('app-update:downloaded', cb),

  isRestartPending: () => ipcRenderer.invoke('restart:is-pending') as Promise<boolean>,
  onRestartPendingChanged: (cb: (pending: boolean) => void) =>
    subscribe<boolean>('restart:pending-changed', cb),

  onQueued: (cb: (p: QueuedPayload) => void) => subscribe<QueuedPayload>('download:queued', cb),
```

새 타입은 필요 없다 — `isRestartPending`은 `Promise<boolean>`, `onRestartPendingChanged`는 이미 있는 `subscribe<boolean>`을 그대로 쓴다.

- [ ] **Step 2: 타입체크와 lint 확인**

Run: `cd <repo> && npm run typecheck`

Expected: `typecheck:node`, `typecheck:web` 모두 오류 없이 종료.

```bash
cd <repo> && npx eslint --no-cache -f json src/preload/index.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `src/preload/index.ts errors=0 warnings=5` (기준선과 같음). 늘어났다면 새로 늘어난 항목만 위 두 줄 안에서 줄바꿈을 조정해 고치되, 기존 항목은 건드리지 마라.

- [ ] **Step 3: 커밋**

```bash
cd <repo> && git add src/preload/index.ts && git commit -m "$(cat <<'EOF'
feat: preload에 재시작 대기 상태 API 노출

렌더러가 restart:is-pending 조회와 restart:pending-changed 구독으로
재시작 대기 상태를 읽을 수 있게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: yt-dlp 자동 주기 확인과 동시 실행 방지

**Files:**

- Modify: `src/main/ytdlp/updater.ts`

- [ ] **Step 1: 주기 상수 추가**

`src/main/ytdlp/updater.ts`에서 아래를 찾아

```ts
const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000
const RESTART_DELAY_MS = 1_500
```

다음으로 바꾼다.

```ts
const VERSION_TIMEOUT_MS = 30_000
const UPDATE_TIMEOUT_MS = 180_000
const RESTART_DELAY_MS = 1_500
const AUTO_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000
```

- [ ] **Step 2: `update()`를 동시 실행 방지 래퍼로 감싸기**

같은 파일에서 아래를 찾아

```ts
export async function update(): Promise<{
  beforeVersion: string
  afterVersion: string
  log: string
  restart: RestartMode
}> {
  broadcast('ytdlp:update:log', '업데이트 확인 중...')
```

다음으로 바꾼다.

```ts
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
```

`update()`의 나머지 본문(버전 비교, 재시작 요청, 반환문)은 그대로 `runUpdate()` 안에 남는다 — 이 Step은 함수 시그니처와 감싸는 부분만 바꾸고 로직은 건드리지 않는다.

- [ ] **Step 3: 시작 시 + 6시간마다 자동 확인**

같은 파일에서 아래를 찾아

```ts
export function registerUpdaterIpc(): void {
  // 앱 시작 시 yt-dlp 바이너리 워밍업 (macOS Gatekeeper, cold start 지연 완화)
  getVersion().catch(() => {
    /* 워밍업 실패는 무시 — 이후 실제 호출에서 에러 처리 */
  })

  ipcMain.handle('ytdlp:version', async () => {
```

다음으로 바꾼다.

```ts
export function registerUpdaterIpc(): void {
  // 앱 시작 시 yt-dlp 바이너리 워밍업 (macOS Gatekeeper, cold start 지연 완화)
  getVersion().catch(() => {
    /* 워밍업 실패는 무시 — 이후 실제 호출에서 에러 처리 */
  })

  // 앱 업데이트와 같은 주기(시작 시 + 6시간마다)로 yt-dlp도 자동 확인한다.
  // 실패는 무시하고 다음 주기에 재시도한다.
  const autoUpdate = (): void => {
    update().catch(() => {
      /* 자동 확인 실패는 무시 */
    })
  }
  autoUpdate()
  setInterval(autoUpdate, AUTO_UPDATE_INTERVAL_MS)

  ipcMain.handle('ytdlp:version', async () => {
```

- [ ] **Step 4: 타입체크와 lint 확인**

Run: `cd <repo> && npm run typecheck`

Expected: 오류 없이 종료. (`update()`가 이제 동기 함수처럼 보이지만 여전히 `Promise<UpdateOutcome>`를 반환하므로, `ipcMain.handle('ytdlp:update', ...)`의 `await update()` 호출부는 수정할 필요가 없다.)

```bash
cd <repo> && npx eslint --no-cache -f json src/main/ytdlp/updater.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `src/main/ytdlp/updater.ts errors=0 warnings=1` (기준선과 같음).

- [ ] **Step 5: 스크래치로 동시 실행 방지 동작 확인**

이 Step은 실제 yt-dlp 바이너리를 실행하지 않고, 동시 호출 시 같은 Promise를 공유하는지만 코드 리딩으로 확인한다: `update()`가 `inFlightUpdate`를 먼저 확인하고, 있으면 그 Promise를 그대로 반환하는 것을 다시 한번 눈으로 확인한다. (이 함수는 `runYtDlpOnce`를 통해 실제 프로세스를 스폰하므로 스크래치 유닛 테스트로 격리하기 어렵다 — Task 8의 패키징 빌드 수동 시나리오에서 실제로 검증한다.)

- [ ] **Step 6: 커밋**

```bash
cd <repo> && git add src/main/ytdlp/updater.ts && git commit -m "$(cat <<'EOF'
feat: yt-dlp 자동 주기 확인과 동시 실행 방지

yt-dlp도 앱 업데이트와 같은 주기(시작 시 + 6시간마다)로 자동 확인하게
했다. 자동 확인과 설정 패널의 수동 확인이 겹치면 yt-dlp -U가 같은
바이너리에 두 번 실행될 수 있어, 진행 중인 update() 호출이 있으면
새 호출도 같은 결과를 기다리도록 감쌌다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 렌더러 재시작 스토어

**Files:**

- Create: `src/renderer/src/stores/restartStore.ts`

- [ ] **Step 1: 스토어 작성**

`src/renderer/src/stores/restartStore.ts`를 만든다.

```ts
import { create } from 'zustand'
import { useDownloadStore } from './downloadStore'

interface RestartState {
  pending: boolean
  forcing: boolean
  init: () => void
  forceRestart: () => Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useRestartStore = create<RestartState>((set, get) => ({
  pending: false,
  forcing: false,

  init: () => {
    if (unsubscribe) return
    window.api.isRestartPending().then((pending) => set({ pending }))
    unsubscribe = window.api.onRestartPendingChanged((pending) =>
      set({ pending, forcing: pending ? get().forcing : false })
    )
  },

  forceRestart: async () => {
    set({ forcing: true })
    const active = useDownloadStore
      .getState()
      .items.filter((it) => it.status === 'queued' || it.status === 'downloading')
    await Promise.all(active.map((it) => window.api.cancelDownload(it.id)))
    // 취소되면 큐가 비어 메인의 재시작 스케줄러가 자동으로 재시작을 실행한다.
    // 여기서 추가로 할 일은 없다 — 재시작이 성사되면 앱이 종료되며 화면이 사라진다.
  }
}))
```

`forcing: pending ? get().forcing : false` — 대기가 풀렸는데(`pending: false`) `forcing`이 계속 켜져 있는 경우를 막는다. 예를 들어 앱 업데이트 설치 파일 준비가 실패해 대기가 풀렸을 때, 사용자가 그 직전에 "지금 재시작"을 눌렀다면 버튼이 로딩 상태로 멈춰 있으면 안 된다.

- [ ] **Step 2: 타입체크와 lint 확인**

Run: `cd <repo> && npm run typecheck:web`

Expected: 오류 없이 종료.

```bash
cd <repo> && npx eslint --no-cache -f json src/renderer/src/stores/restartStore.ts 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `errors=0 warnings=0`.

포맷 확인: `npx prettier --check src/renderer/src/stores/restartStore.ts` → `All matched files use Prettier code style!`. 아니면 `npx prettier --write src/renderer/src/stores/restartStore.ts`.

- [ ] **Step 3: 커밋**

```bash
cd <repo> && git add src/renderer/src/stores/restartStore.ts && git commit -m "$(cat <<'EOF'
feat: 재시작 대기 상태 렌더러 스토어 추가

메인의 restart:is-pending/restart:pending-changed를 구독해 pending
하나로 앱 업데이트·yt-dlp 업데이트를 구분 없이 반영한다. 강제 재시작은
새 IPC 없이 기존 download:cancel을 진행 중인 항목마다 호출해 큐를
비우고, 이미 검증된 자동 재시작 경로가 그대로 실행되게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: App.tsx에 스토어 초기화 연결

**Files:**

- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: import 추가**

`src/renderer/src/App.tsx`에서 아래를 찾아

```tsx
import { useAppUpdateStore } from './stores/appUpdateStore'
```

다음으로 바꾼다.

```tsx
import { useAppUpdateStore } from './stores/appUpdateStore'
import { useRestartStore } from './stores/restartStore'
```

- [ ] **Step 2: 훅 선언 추가**

같은 파일에서 아래를 찾아

```tsx
const initAppUpdate = useAppUpdateStore((s) => s.init)
const checkAppUpdate = useAppUpdateStore((s) => s.check)
const currentVersion = useAppUpdateStore((s) => s.currentVersion)
const updateSettings = useSettingsStore((s) => s.update)
```

다음으로 바꾼다.

```tsx
const initAppUpdate = useAppUpdateStore((s) => s.init)
const checkAppUpdate = useAppUpdateStore((s) => s.check)
const currentVersion = useAppUpdateStore((s) => s.currentVersion)
const initRestart = useRestartStore((s) => s.init)
const updateSettings = useSettingsStore((s) => s.update)
```

- [ ] **Step 3: 초기화 effect에서 호출**

같은 파일에서 아래를 찾아

```tsx
useEffect(() => {
  loadSettings()
  loadPresets()
  initAppUpdate()
  void checkAppUpdate(true)
}, [loadSettings, loadPresets, initAppUpdate, checkAppUpdate])
```

다음으로 바꾼다.

```tsx
useEffect(() => {
  loadSettings()
  loadPresets()
  initAppUpdate()
  initRestart()
  void checkAppUpdate(true)
}, [loadSettings, loadPresets, initAppUpdate, initRestart, checkAppUpdate])
```

- [ ] **Step 4: 타입체크와 lint 확인**

Run: `cd <repo> && npm run typecheck:web`

Expected: 오류 없이 종료.

```bash
cd <repo> && npx eslint --no-cache -f json src/renderer/src/App.tsx 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `src/renderer/src/App.tsx errors=4 warnings=0` (기준선과 같음 — 기존 4건은 `autoPasteStateRef` 관련이며 이 Task가 건드린 줄과 무관하다).

- [ ] **Step 5: 커밋**

```bash
cd <repo> && git add src/renderer/src/App.tsx && git commit -m "$(cat <<'EOF'
feat: 재시작 스토어 초기화 연결

restartStore.init()을 앱 시작 시 호출해 상단 UI가 재시작 대기 상태를
즉시 반영하게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 상단 필을 통합 재시작 버튼으로 변경

**Files:**

- Modify: `src/renderer/src/components/UpdatePill.tsx`

- [ ] **Step 1: 전면 수정**

`src/renderer/src/components/UpdatePill.tsx` 전체를 아래로 바꾼다. (Write 도구를 쓰려면 먼저 파일을 Read 해야 한다.)

```tsx
import { ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useAppUpdateStore } from '../stores/appUpdateStore'
import { useDownloadStore } from '../stores/downloadStore'
import { useRestartStore } from '../stores/restartStore'

export function UpdatePill(): React.JSX.Element | null {
  const phase = useAppUpdateStore((s) => s.phase)
  const restartPending = useRestartStore((s) => s.pending)
  const forcing = useRestartStore((s) => s.forcing)
  const forceRestart = useRestartStore((s) => s.forceRestart)
  const activeDownloads = useDownloadStore(
    (s) => s.items.filter((it) => it.status === 'queued' || it.status === 'downloading').length
  )

  if (restartPending) {
    return (
      <button
        onClick={forceRestart}
        disabled={forcing}
        title={
          activeDownloads > 0 ? `진행 중인 다운로드 ${activeDownloads}개가 중단돼요` : undefined
        }
        className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-[#8b7cf4] to-[#6b5bd9] shadow-[0_4px_12px_-4px_rgba(124,106,232,0.6)] hover:translate-y-px hover:brightness-95 hover:shadow-[0_1px_4px_-2px_rgba(124,106,232,0.6)] active:translate-y-px active:brightness-90 disabled:opacity-70 disabled:pointer-events-none transition-[transform,filter,box-shadow] duration-100"
      >
        <ArrowUpCircle size={12} className={forcing ? 'animate-pulse' : ''} />
        지금 재시작
      </button>
    )
  }

  if (phase === 'checking' || phase === 'available' || phase === 'downloading') {
    return (
      <div className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-[color:var(--color-ghost-muted)] bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)]">
        <RefreshCw size={11} className="animate-spin" />
        버전 확인 중…
      </div>
    )
  }

  return null
}
```

기존의 `phase === 'downloaded'` 분기는 없앤다 — 앱 업데이트가 다운로드를 마치면 `requestRestart('app-update', ...)`가 호출돼 `restartPending`이 거의 동시에 `true`가 되므로, 위의 `restartPending` 분기가 먼저 그려진다.

- [ ] **Step 2: 타입체크와 lint 확인**

Run: `cd <repo> && npm run typecheck:web`

Expected: 오류 없이 종료.

```bash
cd <repo> && npx eslint --no-cache -f json src/renderer/src/components/UpdatePill.tsx 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected: `errors=0 warnings=0` (기준선과 같음).

포맷 확인: `npx prettier --check src/renderer/src/components/UpdatePill.tsx` → `All matched files use Prettier code style!`.

- [ ] **Step 3: 커밋**

```bash
cd <repo> && git add src/renderer/src/components/UpdatePill.tsx && git commit -m "$(cat <<'EOF'
feat: 상단 필을 통합 재시작 버튼으로 변경

앱 업데이트와 yt-dlp 업데이트 중 무엇이든 재시작 대기 중이면 상단에
클릭 가능한 "지금 재시작" 버튼이 뜨게 했다. 자동 재시작은 그대로 두고,
더 기다리지 않고 싶을 때 누르는 수동 경로를 추가한다. 진행 중인
다운로드가 있으면 몇 개가 중단되는지 툴팁으로 알린다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 전체 검증

**Files:** 변경 없음 (검증만).

- [ ] **Step 1: 타입체크**

Run: `cd <repo> && npm run typecheck`

Expected: 오류 없이 종료 (기준선과 같음).

- [ ] **Step 2: 수정 파일별 lint가 기준선보다 늘지 않았는지 확인**

Run:

```bash
cd <repo> && npx eslint --no-cache -f json src/main/restartScheduler.ts src/main/restart.ts src/main/ipc/restart.ts src/main/index.ts src/main/ytdlp/updater.ts src/preload/index.ts src/renderer/src/stores/restartStore.ts src/renderer/src/App.tsx src/renderer/src/components/UpdatePill.tsx 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const f of r){console.log(f.filePath.replace(process.cwd()+'/',''),'errors='+f.errorCount,'warnings='+f.warningCount)}"
```

Expected (기준선과 같거나 낮음):

```
src/main/restartScheduler.ts errors=0 warnings=0
src/main/restart.ts errors=0 warnings=0
src/main/ipc/restart.ts errors=0 warnings=0
src/main/index.ts errors=0 warnings=0
src/main/ytdlp/updater.ts errors=0 warnings=1
src/preload/index.ts errors=0 warnings=5
src/renderer/src/stores/restartStore.ts errors=0 warnings=0
src/renderer/src/App.tsx errors=4 warnings=0
src/renderer/src/components/UpdatePill.tsx errors=0 warnings=0
```

- [ ] **Step 3: 스크래치 테스트 재실행**

Run: `cd <repo> && node --experimental-strip-types --test <scratchpad>/restartSchedulerPending.test.ts`

Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 4: 패키징 빌드**

Run: `cd <repo> && npm run build && npx electron-builder --dir -c.directories.output=<scratchpad>/pkg`

Expected: 오류 없이 끝나고 `<scratchpad>/pkg/mac-arm64/Dovvn.app`이 생성된다. `dist/`는 건드리지 않는다(기존 릴리즈 산출물이 들어 있다). `git status --short`가 비어 있는지 확인한다.

- [ ] **Step 5: 테스트용으로 오래된 yt-dlp를 번들에 넣기**

```bash
cd <repo> && APP_BIN=<scratchpad>/pkg/mac-arm64/Dovvn.app/Contents/Resources/bin && OLD_TAG=$(gh release list -R yt-dlp/yt-dlp --limit 40 --json tagName -q '.[-1].tagName') && gh release download "$OLD_TAG" -R yt-dlp/yt-dlp -p yt-dlp_macos -O "$APP_BIN/yt-dlp" --clobber && chmod +x "$APP_BIN/yt-dlp" && xattr -c "$APP_BIN/yt-dlp" && "$APP_BIN/yt-dlp" --version
```

Expected: 현재 `resources/bin/yt-dlp`보다 오래된 버전이 출력된다.

- [ ] **Step 6: 수동 시나리오 실행**

`<scratchpad>/userdata`를 `--user-data-dir`로 지정해 실제 설정/다운로드와 분리한다.

```bash
"<scratchpad>/pkg/mac-arm64/Dovvn.app/Contents/MacOS/Dovvn" --user-data-dir="<scratchpad>/userdata" &
```

| #   | 시나리오                                                                                                                                                                       | 기대 결과                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 다운로드 없이 위 상태로 앱 실행                                                                                                                                                | 몇 초~수십 초 안에 yt-dlp가 자동으로 확인·설치되고, 곧이어 상단에 "지금 재시작" 버튼이 잠깐 보였다가 자동으로 재시작된다 (창이 빠르게 닫혔다 다시 뜬다)             |
| 2   | Step 5로 yt-dlp를 다시 오래된 버전으로 되돌린 뒤, 아무 URL이나 다운로드 시작 후 곧바로 앱을 재실행(자동 확인이 트리거되도록 대기하거나 설정 패널에서 수동으로 "업데이트 확인") | 다운로드가 진행 중인 동안 상단에 "지금 재시작" 버튼이 뜨고, 자동 재시작은 일어나지 않는다. 버튼에 마우스를 올리면 "진행 중인 다운로드 1개가 중단돼요" 툴팁이 보인다 |
| 3   | 시나리오 2 상태에서 "지금 재시작" 버튼을 클릭                                                                                                                                  | 진행 중이던 다운로드가 `실패`로 표시되고, 몇 초 안에 앱이 재시작된다. 재시작 후 yt-dlp 버전이 최신이다                                                              |
| 4   | 재시작 후 다시 자동 확인 시점까지 대기(또는 설정 패널에서 수동 확인)                                                                                                           | 이미 최신이므로 재시작이 일어나지 않고 버튼도 뜨지 않는다                                                                                                           |
| 5   | 다운로드 중 버튼이 뜬 상태에서 창을 닫았다가(빨간 버튼) Dock 아이콘으로 다시 열기                                                                                              | 새로 뜬 창에도 "지금 재시작" 버튼이 바로 보인다 (메인 프로세스가 재시작 대기 상태를 유지하고 있었음을 확인)                                                         |
| 6   | 설정 패널을 열어 yt-dlp/Dovvn 섹션의 수동 "업데이트 확인" 버튼을 각각 눌러보기                                                                                                 | 기존처럼 정상 동작한다 (자동 확인과 동시에 일어나도 오류 없이 같은 결과를 보여준다)                                                                                 |

- [ ] **Step 7: 정리**

```bash
pkill -f "<scratchpad>/pkg/mac-arm64/Dovvn.app" 2>/dev/null
rm -rf <scratchpad>/pkg <scratchpad>/userdata
cd <repo> && git status --short
```

Expected: 실행 중인 테스트 프로세스가 없고, `git status --short`가 비어 있다.

- [ ] **Step 8: 작업 트리 확인**

Run: `cd <repo> && git status --short && git log --oneline main..HEAD`

Expected: `git status`는 출력이 없다. `git log`에는 스펙 커밋과 Task 1~7의 커밋이 순서대로 보인다.

---

## 릴리즈 시 CHANGELOG에 넣을 문구

`CONTRIBUTING.md` 규칙에 따라 릴리즈 커밋에서 새 버전 섹션(`## x.y.z`)을 만들 때 아래를 사용한다. 이번 계획에서는 `CHANGELOG.md`를 수정하지 않는다 — 병합 후 릴리즈 시점에 버전 번호와 함께 넣는다.

```markdown
- yt-dlp 업데이트도 앱처럼 자동으로 확인해요. 설정을 열지 않아도 최신 상태를 유지해요
- 업데이트가 있으면 상단에 "지금 재시작" 버튼이 떠요. 다운로드가 끝나길 기다리지 않고 바로 재시작할 수 있어요 (진행 중인 다운로드는 중단돼요)

### 내부

- yt-dlp 자동 확인이 앱 업데이트와 같은 주기(시작 시 + 6시간마다)로 동작. 수동 확인과 겹쳐도 yt-dlp -U가 중복 실행되지 않도록 방지.
- 재시작 대기 상태를 메인 프로세스에서 IPC로 노출(`restart:is-pending`, `restart:pending-changed`)해 앱 업데이트/yt-dlp 업데이트를 하나의 신호로 통합.
```

## 알려진 한계 (스펙과 동일)

- 창을 완전히 닫아둔 사이에는 앱 업데이트 주기 확인이 멈춘다(렌더러 타이머). yt-dlp 쪽은 메인 타이머라 이 한계가 없다.
- "지금 재시작" 버튼을 눌렀을 때 취소되는 다운로드는 되돌릴 수 없다. 확인 다이얼로그 없이 툴팁 경고만 제공한다.
- 이전 스펙(`2026-09-21-auto-restart-after-update-design.md`)의 알려진 한계도 그대로 유효하다.
