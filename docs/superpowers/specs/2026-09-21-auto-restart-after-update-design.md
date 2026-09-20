# 업데이트 후 자동 재시작 설계

## 배경

Dovvn에는 두 가지 업데이트가 있다. 현재 재시작 동작은 다음과 같다.

| 업데이트              | 현재 동작                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| 앱 (electron-updater) | 다운로드 완료 후 사용자가 "업데이트 설치" 버튼을 눌러야 종료→교체→재시작 (`src/main/ipc/appUpdater.ts`) |
| yt-dlp (`yt-dlp -U`)  | 바이너리만 교체하고 재시작 없음 (`src/main/ytdlp/updater.ts`)                                           |

사용자가 직접 써보니 yt-dlp 업데이트 후 앱을 재시작하지 않으면 오류가 발생한다. (오류 원인은 이번 범위에서 조사하지 않는다. 재시작이 필요하다는 관찰을 전제로 한다.)

두 업데이트 모두 업데이트 직후 자동으로 종료했다가 재시작하도록 바꾼다.

## 확정된 결정

1. yt-dlp 업데이트는 즉시 수행하고, **재시작은 진행 중·대기 중인 다운로드가 모두 끝난 뒤** 수행한다.
2. 앱 업데이트는 다운로드가 끝나면 **클릭 없이 자동 재시작**한다. 다운로드가 있으면 마찬가지로 끝날 때까지 기다린다.
3. 재시작 대기 중에는 **새 다운로드 시작을 차단**한다.

## 왜 대기가 필요한가

yt-dlp는 `detached: true`로 별도 프로세스 그룹에서 실행되고(`runner.ts`), 종료 시 다운로드를 정리하는 코드(`before-quit` 등)가 없다. 다운로드 중에 앱이 종료되면 yt-dlp가 고아 프로세스로 남는다. 현재의 앱 업데이트 경로에도 같은 문제가 있으며, 이번 변경이 이를 함께 해소한다.

## 설계

### 1. 재시작 스케줄러 (`src/main/restart.ts`, 신규)

```ts
type RestartReason = 'app-update' | 'ytdlp-update'

requestRestart(reason: RestartReason, run: () => boolean): 'now' | 'deferred'
isRestartPending(): boolean
```

- 요청 시점부터 `isRestartPending()`이 `true`가 되고, 실제로 프로세스가 종료될 때까지 유지된다. `run`이 실행된 뒤 종료되기까지의 지연 구간(수백 ms~1.5초)에 새 다운로드가 끼어들어 고아 프로세스가 생기는 것을 막기 위해서다.
- 큐가 비어 있으면 `run`을 즉시 실행하고 `'now'`를 반환한다.
- 비어 있지 않으면 `run`을 저장하고 `'deferred'`를 반환한다.
- 큐가 비는 순간 저장된 `run`을 한 번만 실행한다.
- `run`은 재시작을 시작했으면 `true`, 시작하지 못했으면 `false`를 반환한다. `false`이면 스케줄러가 대기 상태를 해제해 새 다운로드 차단을 푼다.
- 대기 중(`run` 실행 전)에 요청이 또 들어오면 `app-update`가 우선한다. 앱 업데이트는 어차피 프로세스를 재시작하기 때문이다. 그 외에는 먼저 저장된 요청을 유지한다. `run`이 이미 실행된 뒤의 요청은 무시한다.

### 2. 큐 유휴 알림 (`src/main/ytdlp/queue.ts`)

- `onIdle(listener: () => void)`를 추가한다.
- `drain()` 종료 시점에 `active.size === 0 && waiting.length === 0`이면 리스너를 호출한다.
- 의존 방향은 `restart.ts → queue.ts` 한 방향이다. `queue.ts`는 `restart.ts`를 알지 못한다.
- 큐 상태 확인은 기존 `getQueueSnapshot()`을 재사용한다.

### 3. yt-dlp 경로 (`src/main/ytdlp/updater.ts`)

- `update()` 성공 후 전후 버전이 **둘 다 확인되고 서로 다를 때만** 재시작을 요청한다. 이미 최신이거나 버전 확인에 실패(`'?'`)하면 재시작하지 않는다.
- 재시작 동작: `app.relaunch(); app.exit(0)`. 렌더러가 결과 메시지를 표시할 시간을 주려고 약 1.5초 뒤에 실행하며, `run`은 곧바로 `true`를 반환한다.
- 개발 모드(`!app.isPackaged`)에서는 `requestRestart`를 호출하지 않고 로그만 남기며 `restart: 'none'`을 반환한다.
- IPC 반환값에 `restart: 'now' | 'deferred' | 'none'`을 추가한다.

### 4. 앱 업데이트 경로 (`src/main/ipc/appUpdater.ts`)

- `app-update:quit-and-install` 핸들러 본문을 `installDownloadedUpdate(): boolean`으로 분리한다. `prepareNewApp`, `runReplaceScript`, `app.quit()` 로직은 그대로 두고, 파일 준비에 실패하면 `false`, 교체 스크립트를 띄웠으면 `true`를 반환한다.
- `update-downloaded` 이벤트에서 `requestRestart('app-update', installDownloadedUpdate)`를 자동 호출한다.
- 기존 `app-update:quit-and-install` IPC 핸들러는 남기되 같은 `requestRestart`를 거치게 한다. 다운로드 도중 클릭해도 고아 프로세스가 생기지 않는다.

### 5. 새 다운로드 차단 (`src/main/ipc/download.ts`)

- `download:start`에서 `isRestartPending()`이면 큐에 넣지 않는다.
- 기존 `download:error` 이벤트로 "업데이트 적용을 위해 재시작 대기 중이라 다운로드를 시작할 수 없어요"를 보내고 `{ ok: false, error }`를 반환한다.
- `startDownload`의 preload 시그니처는 타입 없는 `invoke`이고 호출부가 반환값을 쓰지 않으므로, 렌더러 훅(`useStartDownload`)과 preload 타입은 수정하지 않는다. 차단된 항목은 기존 오류 경로로 실패 표시되고 재시도할 수 있다.

### 6. UI (최소 변경)

새 IPC 채널은 만들지 않는다.

- `UpdatePill`의 `downloaded` 상태를 클릭 버튼에서 "다운로드 완료 후 자동 재시작" 상태 표시로 바꾼다. 큐가 비어 있으면 곧바로 재시작되므로 짧게 보였다 사라진다.
- 설정 패널 "Dovvn" 섹션의 "재시작하여 설치" 버튼은 자동 재시작과 역할이 겹치므로 안내 문구로 바꾼다.
- 설정 패널 yt-dlp 섹션은 반환된 `restart` 값에 따라 메시지를 바꾼다.
  - `now`: "{전} → {후} 업데이트 완료 — 잠시 후 재시작합니다"
  - `deferred`: "{전} → {후} 업데이트 완료 — 다운로드가 끝나면 재시작합니다"
  - `none`: 기존 메시지 유지

## 에러 처리와 엣지 케이스

- 앱 업데이트 파일 준비 실패(`prepareNewApp`이 `null`): 기존과 동일하게 `app-update:error`를 보내고 `installDownloadedUpdate()`가 `false`를 반환한다. 스케줄러가 대기 상태를 해제하므로 새 다운로드가 계속 차단되지 않는다.
- yt-dlp 업데이트와 앱 업데이트가 같은 대기 구간에 겹치면 앱 업데이트가 우선한다.
- 재시작 대기 중 사용자가 다운로드를 취소해 큐가 비면 그 시점에 재시작한다. (`cancel` → 프로세스 종료 → `onComplete`/`onError` → `drain()` 경로로 유휴 알림이 발생한다.)

## 범위 밖 (알려진 한계)

- 앱 업데이트는 `.app` 전체를 교체하므로 `yt-dlp -U`로 올려둔 yt-dlp가 번들에 들어 있던 버전으로 되돌아갈 수 있다. (`resources/bin/*`은 gitignore 대상이며 바이너리는 빌드 시점에 번들된다. 코드 기반 추론이며 실제 번들 구성은 확인하지 않았다.)
- 재시작 시점에 진행 중인 영상 정보 조회(`video:info`)는 끊긴다. 별도로 처리하지 않는다.
- yt-dlp 오류가 재시작 없이는 왜 발생하는지 원인 조사는 하지 않는다.

## 검증

이 프로젝트에는 테스트 러너가 없다. 다음으로 검증한다.

- `npm run typecheck`, `npm run lint`
- 수동 시나리오 (패키징 빌드 기준, 개발 모드는 재시작을 생략하므로 스케줄러 동작과 차단만 확인):
  1. 다운로드가 없을 때 yt-dlp 업데이트 → 버전이 바뀌면 곧바로 재시작
  2. 다운로드 중 yt-dlp 업데이트 → 다운로드 종료 후 재시작
  3. 재시작 대기 중 새 다운로드 시작 → 차단 메시지, 항목은 실패로 표시
  4. 이미 최신인 상태에서 yt-dlp 업데이트 → 재시작하지 않음
  5. 앱 업데이트 다운로드 완료 → 다운로드가 없으면 클릭 없이 재시작, 있으면 종료 후 재시작

## 후속 (구현 시 함께 처리)

- 사용자가 체감하는 변경이므로 `CONTRIBUTING.md` 규칙에 따라 다음 릴리즈의 `CHANGELOG.md`에 기록한다.
