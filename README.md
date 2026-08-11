# video-downloader

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Native binaries

`resources/bin/`의 실행 파일은 용량 문제로 저장소에 포함하지 않습니다. clone 후 아래 파일을 직접 배치해야 개발·빌드가 동작합니다.

| 파일 | 아키텍처 | 출처 |
| --- | --- | --- |
| `yt-dlp` | universal (x86_64 + arm64) | [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) — `yt-dlp_macos` |
| `ffmpeg` | arm64 | [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) 또는 Homebrew `ffmpeg` |
| `aria2c` | arm64 | Homebrew `aria2` |
| `lib{sqlite3,ssl.3,crypto.3,ssh2.1,cares.2,intl.8}.dylib` | arm64 | `aria2c`의 의존 라이브러리 |

`aria2c`는 Homebrew 경로 대신 `@loader_path`를 참조하도록 재배선되어 있습니다. Homebrew에서 새로 가져온 경우 dylib을 같은 디렉터리에 복사한 뒤 `install_name_tool`로 경로를 다시 지정해야 합니다.

배치 후 실행 권한을 부여합니다.

```bash
$ chmod +x resources/bin/{yt-dlp,ffmpeg,aria2c}
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
