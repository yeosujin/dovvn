# Dovvn

유령이 영상 몰래 훔쳐다 주는 다운로더.

`yt-dlp`를 감싼 macOS용 데스크톱 앱입니다. URL을 붙여넣으면 해상도·포맷·자막·구간을 고른 뒤 큐에 넣어 내려받습니다.

## 설치

[Releases](https://github.com/yeosujin/dovvn-release/releases)에서 최신 `.dmg`를 받으세요. 앱 안에서 새 버전을 감지해 자동으로 업데이트합니다.

## 기능

- **포맷 선택** — 해상도, 컨테이너(mp4 / mkv / webm), 비디오 코덱(auto / H.264 / VP9 / AV1)
- **오디오만 추출** — mp3 / m4a / wav
- **자막** — 업로더 원본 자막과 자동 생성 자막을 언어별로 선택, 별도 파일로 저장하거나 영상에 임베드
- **구간 자르기** — 시작·끝 시간을 지정해 일부만 저장
- **플레이리스트** — 항목을 골라서 한 번에 다운로드
- **다운로드 큐** — 진행률·속도·남은 시간 표시, 동시 실행 개수 설정
- **프리셋** — 자주 쓰는 옵션 조합을 저장해두고 재사용
- **클립보드 자동 붙여넣기** — 앱을 켜면 복사해둔 링크가 입력창에 채워짐
- **플랫폼별 하위 폴더** — 저장 경로를 플랫폼 이름으로 나눠 정리

### 지원 사이트

YouTube, Vimeo, TikTok, Instagram, X, Facebook, Twitch, SoundCloud, Naver TV, Kakao TV는 아이콘과 전용 저장 폴더로 인식합니다. 그 외 URL도 `yt-dlp`가 지원하는 사이트라면 그대로 처리합니다.

## 개발

브랜치·커밋·PR 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

### Install

```bash
$ npm install
```

### Native binaries

`resources/bin/`의 실행 파일은 용량 문제로 저장소에 포함하지 않습니다. clone 후 아래 파일을 직접 배치해야 개발·빌드가 동작합니다.

| 파일                                                      | 아키텍처                   | 출처                                                                          |
| --------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `yt-dlp`                                                  | universal (x86_64 + arm64) | [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) — `yt-dlp_macos` |
| `ffmpeg`                                                  | arm64                      | [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) 또는 Homebrew `ffmpeg`      |
| `aria2c`                                                  | arm64                      | Homebrew `aria2`                                                              |
| `lib{sqlite3,ssl.3,crypto.3,ssh2.1,cares.2,intl.8}.dylib` | arm64                      | `aria2c`의 의존 라이브러리                                                    |

`aria2c`는 Homebrew 경로 대신 `@loader_path`를 참조하도록 재배선되어 있습니다. Homebrew에서 새로 가져온 경우 dylib을 같은 디렉터리에 복사한 뒤 `install_name_tool`로 경로를 다시 지정해야 합니다.

배치 후 실행 권한을 부여합니다.

```bash
$ chmod +x resources/bin/{yt-dlp,ffmpeg,aria2c}
```

### Commands

| 명령                  | 설명                                          |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | 개발 모드 실행                                |
| `npm run typecheck`   | main·renderer 타입 검사                       |
| `npm run lint`        | ESLint                                        |
| `npm run format`      | Prettier                                      |
| `npm run build:mac`   | macOS 앱 빌드 (배포 없음)                     |
| `npm run release:mac` | 릴리즈 노트 생성 → 빌드 → GitHub Release 발행 |

`build:win`, `build:linux` 스크립트도 남아 있지만 macOS 외 플랫폼은 검증하지 않았습니다. 코드 서명 훅(`build/afterSign.js`)과 번들 바이너리가 모두 macOS arm64 기준입니다.

## 구조

```
src/
├── main/          Electron 메인 프로세스
│   ├── ipc/       렌더러와의 IPC 핸들러 (다운로드·설정·프리셋·업데이터)
│   └── ytdlp/     yt-dlp 실행, 출력 파싱, 다운로드 큐, 바이너리 업데이트
├── preload/       contextBridge API와 공유 타입
└── renderer/      React UI (Zustand 스토어 + Tailwind)
```

`preload/video-types.ts`는 메인과 렌더러가 공유하는 비디오 정보 타입의 단일 출처입니다. IPC 페이로드 필드가 한쪽에서만 바뀌어 조용히 누락되는 일을 막습니다.

## 릴리즈

1. `CHANGELOG.md` 맨 위에 `## x.y.z` 섹션을 추가하고 변경 사항을 불릿으로 적습니다. 사용자에게 노출하지 않을 내부 변경은 같은 섹션 안 `### 내부` 아래에 둡니다.
2. `package.json`의 `version`을 올립니다.
3. `npm run release:mac`

`scripts/release-notes.mjs`가 현재 버전 섹션만 뽑아 `build/release-notes.md`로 만들고, 빌드 결과물이 [dovvn-release](https://github.com/yeosujin/dovvn-release)에 올라간 뒤 `scripts/publish-release-notes.mjs`가 `gh release edit`으로 본문을 갱신합니다. GitHub 발행에는 `GH_TOKEN`과 [gh CLI](https://cli.github.com/) 인증이 필요합니다.

## 서드파티

번들에 포함되는 실행 파일은 각자의 라이선스를 따릅니다.

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Unlicense
- [FFmpeg](https://ffmpeg.org/) — LGPL 2.1+ / GPL 2+ (빌드 구성에 따름)
- [aria2](https://aria2.github.io/) — GPL 2+
