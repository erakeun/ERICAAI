# 자동 검증 실행

앱 폴더에서 `npm test`를 실행하면 Node.js 내장 테스트 러너로 모든 `*.test.mjs`를 실행합니다. 앱과 단위 테스트에는 `npm install`이 필요하지 않습니다. 명패 제작기 수신 계약 테스트는 실제 기존 소스에서 가져온 `fixtures/`를 사용하므로 별도 참조 저장소가 없어도 동일하게 실행됩니다.

`browser-e2e.mjs`는 실제 HTML 화면·입력·다운로드·새로고침을 사용하는 추가 브라우저 회귀 테스트입니다. 실행에는 Playwright와 해당 환경의 Chromium 또는 Chrome이 필요합니다. 이 테스트는 Codex 내부 브라우저의 수동 검증을 대체하지 않습니다.

## 표준 Playwright 환경

앱 폴더에서 서버를 실행합니다.

```sh
npm start
```

Playwright 패키지와 Chromium이 개발 환경에 이미 설치되어 있다면 다른 터미널에서 다음과 같이 실행합니다.

```sh
node tests/browser-e2e.mjs http://127.0.0.1:4183/ /tmp/interview-oneq-browser-qa
```

## 기존 도구 경로 사용

별도 디렉터리에 준비된 Playwright와 Chrome을 사용하려면 환경변수를 지정합니다. 아래 경로는 해당 환경의 실제 설치 경로로 바꿉니다.

```sh
MACH_PLAYWRIGHT_MODULE="/actual/path/to/playwright/index.mjs" \
MACH_CHROME="/actual/path/to/chrome" \
node tests/browser-e2e.mjs http://127.0.0.1:4183/ /tmp/interview-oneq-browser-qa
```

`MACH_PLAYWRIGHT_MODULE`이 없으면 표준 `playwright` 패키지를 읽고, `MACH_CHROME`이 없으면 Playwright가 관리하는 Chromium을 사용합니다. 소스에는 특정 사용자의 홈 디렉터리나 특정 운영체제의 브라우저 실행 경로를 기본값으로 넣지 않았습니다.

앱 URL은 **현재 실행 중인 서버의 실제 앱 경로**여야 합니다. 상위 작업 폴더를 제공하는 서버라면 `/outputs/interview-oneq/` 등 실제 하위 경로를 사용합니다. 증빙 폴더에는 테스트용 JSON/CSV/XLSX/HTML/PNG와 `report.json`이 저장됩니다. 실제 사용자 프로필은 사용하지 않으며 테스트마다 별도의 임시 브라우저 컨텍스트를 만듭니다.

테스트는 uncaught JavaScript 오류, console error, HTTP 400 이상, 실패 네트워크 요청도 검사합니다. 새로고침으로 의도적으로 취소된 `net::ERR_ABORTED` 요청은 실패로 집계하지 않습니다. 실패한 테스트는 종료코드 1과 `report.json`의 스택으로 보고하며 skip 처리하지 않습니다.
