# Changelog

이 파일은 사용자에게 보여줄 릴리즈 노트의 원본이에요. 새 버전을 낼 땐 가장 위에
`## x.y.z` 섹션을 추가하고, 그 아래에 `- ` 불릿으로 변경 사항을 적어주세요.
빌드 시 `scripts/release-notes.mjs`가 현재 `package.json` 버전의 섹션만 추출해서
GitHub Release 본문에 자동으로 올려요.

사용자에게 노출하지 않을 내부 변경(빌드/도구 등)은 같은 버전 섹션 안에
`### 내부` 서브섹션으로 적어두면 release notes에 포함되지 않아요.

## 2.3.1

- 회사·학교처럼 보안 프로그램이 트래픽을 검사하는 네트워크에서 "certificate verify failed" 오류로 다운로드가 안 되던 문제를 고쳤어요
- 위 환경에서 영상 정보를 불러오는 속도도 함께 빨라졌어요

### 내부

- macOS 시스템 키체인에서 CA 번들을 추출해 yt-dlp에 주입 (`--compat-options no-certifi` + `SSL_CERT_FILE`).
  yt-dlp는 번들 certifi를 우선 로드해 `SSL_CERT_FILE`을 무시하므로 두 설정이 모두 필요하다.
- YouTube fast path(youtubei.js)를 Node 기본 fetch에서 Electron `net.fetch`로 전환.
  Chromium 네트워크 스택을 거치므로 OS 인증서 저장소를 그대로 따른다.

## 2.3.0

- 앱을 켜면 클립보드에 복사된 영상 링크가 입력창에 자동으로 채워져요 (설정에서 끌 수 있어요)

### 내부

- 개발 환경에서만 보이던 업데이트 안내 mock 제거

## 2.2.2

- 변경사항이 없는 업데이트에서는 안내 토스트가 더 깔끔하게 표시되도록 정리

### 내부

- 릴리즈 노트 자동 생성 파이프라인 추가 (CHANGELOG.md 기반)
- electron-builder publish 후 gh release edit으로 본문 갱신하는 후처리 추가

## 2.2.1

- 업데이트 다운로드를 자동으로 시작하도록 개선
- 설정 화면의 업데이트 표기를 간결하게 정리
- 업데이트 적용 후 변경사항 안내 추가

## 2.2.0

- 영상 구간 자르기 추가 (시작·끝 시간 지정)
- yt-dlp 안정성 개선
