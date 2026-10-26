# MACH 명찰 디자인·자산 출처

확인일: 2026-10-26. 본 문서는 실제로 읽고 확인한 참고 체크아웃과 재사용 자산을 기록한다. 명찰 템플릿은 아래 기존 앱의 디자인 언어를 실제 명찰 삽입지 크기에 맞춰 새로 구성한 HTML/CSS이며, 기존 인쇄용 배경 이미지를 잘라 쓰지 않았다.

## 확인한 네 가지 앱

| 참고 체크아웃 | 확인한 HEAD | 실제 참고 파일·요소 |
| --- | --- | --- |
| `reference-mail` | `14a4b7ebb74bcef8e507c8dab837b14d67104edd` | `index.html`, `card-templates.js`: 한양 블루 이름, 흰 바탕, 골드 룰, 블루 하단 바, 가로 로고와 캐릭터 배치. `assets/templates/`의 실제 배경 PNG와 `assets/logos/`의 한양대학교·ERICA 로고를 확인. |
| `reference-notice` | `60020e6519cc9d1fcda79ea5e76ebcadbf7ade6f` | `index.html`: `--blue:#0E4A84`, 템플릿 선택과 실시간 미리보기, 원본 블루·흰색 로고 선택. `logos/README.txt`, 실제 한양대학교·ERICA 가로 로고 및 `templates/landscape/` 배경 PNG 확인. |
| `reference-signage` | `4352905ad30a279065ee9b47353c65f8807ddfd0` | `index.html`: `--blue:#0E4A84`, 네이비·골드 조합, 단계별 빠른 입력, 상단 MACH 홈 로고. |
| `reference-nameplate` | `63349f1e996358bec900867321dcb1bf25d9450a` | `index.html`: 좌측 설정 / 우측 미리보기 2열, `#f3f5f8` 배경, `#d9e0e8` 경계, `#1f2937` 본문, `#667085` 보조문구, 14px 안팎 패널 모서리, mm 규격, 명단 표, JSON 명시적 저장·불러오기 및 인쇄 흐름. `assets/template-frame.png`의 네이비 프레임과 하단 사선을 확인. |

참고 체크아웃은 작업 저장소의 형제 디렉터리이며, 런타임 의존성은 아니다. 참조 파일에 있던 외부 폰트 CDN, 자동 저장 또는 기타 앱 기능을 이식하지 않았다.

원본 저장소는 각 체크아웃의 `origin`으로 확인했다: [메일 명함](https://github.com/erakeun/mail-card-maker/tree/14a4b7ebb74bcef8e507c8dab837b14d67104edd), [안내문](https://github.com/erakeun/notice-maker/tree/60020e6519cc9d1fcda79ea5e76ebcadbf7ade6f), [디지털 사이니지](https://github.com/erakeun/digital-signage-maker/tree/4352905ad30a279065ee9b47353c65f8807ddfd0), [행사용 명패](https://github.com/erakeun/nameplate-maker/tree/63349f1e996358bec900867321dcb1bf25d9450a). 위 링크는 검사한 커밋을 고정한다.

## 로컬 복사 자산

원본 파일을 수정 없이 복사했다. 색상·비율을 보존하며 CSS로 크기만 조절한다. 모든 이미지 요청은 현재 앱과 같은 정적 사이트에서 이루어진다.

| 앱 내 파일 | 원본 경로 및 체크아웃 | 원본/복사본 SHA-256 |
| --- | --- | --- |
| `assets/hyu.png` | `reference-notice/logos/hyu.png` (`60020e…`) | `11c67169920d4ea24da0910f7b6cc7ca9c1a2d2d78f5d5f726edc5e5ec1ecc32` |
| `assets/hyu-white.png` | `reference-notice/logos/hyu_white.png` (`60020e…`) | `a9b0c8baee93f53a6079829a210513a529d3de6b8c9b52672aacd7b139e2229f` |
| `assets/hyu-erica.png` | `reference-notice/logos/hyu_erica.png` (`60020e…`) | `40134c8c7d76aa013cba8c2aa04ed935927c40b5ad25e5c55f2e0444e18d371a` |
| `assets/hyu-erica-white.png` | `reference-notice/logos/hyu_erica_white.png` (`60020e…`) | `c1c0e8d6c3221d92e8f85d58489813481c54ad59d32993dad521a00b68b109ab` |
| `assets/hanyangi.png` | `reference-mail/assets/chars/hanyangi_01.png` (`14a4b7…`) | `e87907a23a7197256d841832cccbf1fadb3c204b79b0cbed2e8079ef87e79a89` |
| `assets/hibb.png` | `reference-mail/assets/chars/hibibi_01.png` (`14a4b7…`) | `819012d8ef6762f7a4db64a7df35d3d6826cf84fa23e17177fd7d36016979cc8` |
| `assets/mach-selected-A.svg` | `reference-nameplate/assets/mach-selected-A.svg` (`63349f…`) | `4296ab96d8a536418a3aa92c149ce16e3261a7250ae4d9a9b2c012f8c6d68bb8` |

기존 자산의 브랜드 권리나 사용 허가 범위를 새롭게 주장하지 않는다. 출처 체크아웃의 실제 자산을 같은 MACH 도구군의 명찰 용도로 재사용했다.

### 로고 원본과 픽셀 확인

`sharp`로 PNG 메타데이터와 디코딩된 RGBA 픽셀을 검사하고 실제 이미지를 열어 확인했다. 흰색 ERICA 로고는 검사용 임시 사본에 블루 배경을 합성해 모양을 확인했으며, 앱에는 투명 원본만 복사했다. 아래 경계는 알파가 0보다 큰 픽셀의 `x, y, 너비, 높이`이며 좌상단은 `(0, 0)`이다.

| 앱 내 파일 | 원본 크기 (px) | 원본 가로/세로 비율 | 불투명도 > 0인 영역 | 완전 투명 / 완전 불투명 / 반투명 픽셀 |
| --- | --- | --- | --- | --- |
| `hyu.png` | 2048 × 446 | 4.591928 | 0, 0, 2048, 446 | 573165 / 320433 / 19810 |
| `hyu-white.png` | 2710 × 591 | 4.585448 | 0, 0, 2710, 591 | 1016543 / 570063 / 15004 |
| `hyu-erica.png` | 2048 × 319 | 6.420063 | 31, 28, 1986, 268 | 455297 / 176723 / 21292 |
| `hyu-erica-white.png` | 2269 × 354 | 6.409605 | 35, 31, 2199, 296 | 567160 / 223956 / 12110 |

네 파일 모두 알파 채널이 있다. 블루 원본의 가장 많은 가시 픽셀색은 `#004483`이며 UI 색상 `#0E4A84`와 구분한다. 흰색 원본의 모든 가시 픽셀은 RGB `255,255,255`이며 가장자리의 원래 알파를 보존한다. 재색칠, 재제작, 자르기, 여백 제거, 비율 변경은 하지 않았다. ERICA 로고의 투명 여백도 원본의 일부로 유지하며 각 파일의 고유 비율로 표시한다.

`reference-mail/assets/logos/hyu.png`와 `hyu_erica.png`는 각각 안내문 앱의 블루 원본과 SHA-256 및 전체 바이트가 일치한다. 안내문 앱의 `logos/README.txt`도 두 가로형 로고의 출처를 기존 메일명함 제작기로 명시한다. 안내문 앱에서 제공하는 블루·흰색 쌍을 함께 사용하므로 앱에서 블루 파일을 CSS 필터로 흰색으로 바꾸지 않는다. 위 표의 일곱 복사 자산은 모두 기록한 원본과 전체 바이트 일치를 다시 확인했다.

### 로고 선택

로고는 템플릿과 독립적으로 선택한다. 두 명찰 제작기는 같은 `logoMode` 값을 사용한다.

| 값 | 화면 선택 | 명찰에 쓰는 자산 |
| --- | --- | --- |
| `none` | 없음 | 대학 로고를 표시하지 않음 |
| `hanyang` | 한양대학교 | `hyu.png` 또는 `hyu-white.png` |
| `erica` | ERICA | `hyu-erica.png` 또는 `hyu-erica-white.png` |
| `both` | 둘 다 | 한양대학교와 ERICA 원본을 각각 독립된 이미지로 함께 배치 |

한양 블루(`blue`)와 행사·스태프(`staff`)는 원본 흰색 로고, 나머지 템플릿은 원본 블루 로고를 사용한다. 두 로고를 함께 선택해도 하나의 새 로고로 합성하지 않는다. 새 작업의 기본값은 `both`이며, 로고 선택이 없던 기존 버전 1 작업 파일은 기존 표시를 유지하도록 `hanyang`으로 읽는다. 명시적인 로고 선택은 JSON 작업 파일에 함께 저장한다.

## 폰트와 색상

- 글꼴 순서: `Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif`. `reference-nameplate/index.html`의 글꼴 스택을 따른다. 로컬에 설치된 글꼴을 사용하며 외부 폰트 요청이나 라이선스가 확인되지 않은 OS 폰트 파일 복사는 하지 않는다. 따라서 기기에 따라 글자 모양이 조금 다를 수 있다.
- 대표 한양 블루: `#0E4A84` (`reference-notice`·`reference-signage`의 실제 CSS 변수).
- 공식 심플의 골드: `#88774F` (`reference-mail/card-templates.js`의 `gold_rule`). 블루 시그널의 초록 포인트는 같은 파일의 `blue_signal`에 있는 `#7DB928`을 따른다.
- 일반 UI의 색·경계·입력·인쇄 안내 흐름은 위 명패 앱을 참조하며, 새 템플릿용 보조 네이비 `#123655`, 밝은 블루·보랏빛 면, 스태프 표시용 골드 `#E5B85D`를 추가했다.

## 여덟 명찰 템플릿과 실제 원본 대응

배경 PNG는 출처와 구성을 확인하는 참고 자료이며 앱으로 복사하지 않았다. 인쇄용 도형·선·텍스트 영역은 명찰의 다양한 mm 규격에 맞춰 HTML/CSS로 재구성한다. 로고가 있는 구성은 위의 선택에 따라 달라진다.

| 템플릿 ID / 이름 | 확인한 실제 원본 | 명찰에 반영한 구성 |
| --- | --- | --- |
| `blue` / 한양 블루 | `reference-notice/templates/landscape/template_01.png` (`Classic Blue`), `reference-notice/index.html`의 템플릿 1 | 블루 상단 영역과 얇은 하단 선, 흰색 로고, 흰 본문 위 중앙 이름. |
| `official` / 공식 심플 | `reference-mail/assets/templates/mailcard_template_02_gold_rule.png`, `card-templates.js`의 `gold_rule` | 흰 바탕, 블루 로고와 이름, 골드 구분선 및 여백. |
| `hanyang` / 하냥이 | `reference-mail/assets/chars/hanyangi_01.png`, `card-templates.js`의 `CARD_TEMPLATES.default.layout.characterBox` | 원본 하냥이를 인적 사항 옆에 배치하고 명찰용 밝은 블루 면을 구성. 세로 규격에서는 캐릭터를 아래로 배치. |
| `hibb` / HiBB | `reference-mail/assets/chars/hibibi_01.png`, `card-templates.js`의 `CARD_TEMPLATES.default.layout.characterBox` | 원본 HiBB와 명찰용 밝은 보랏빛 면. 캐릭터 자리와 텍스트 영역을 분리. |
| `staff` / 행사·스태프 | `reference-signage/index.html`의 `TEMPLATES` 중 `id:2` 딥 네이비와 `id:4` 골드 다크 | 어두운 네이비 면, 흰색 로고, 골드 역할 표기. 직책·역할은 입력한 값만 사용. |
| `ribbon` / 블루 시그널 | `reference-mail/assets/templates/mailcard_template_05_blue_signal.png`, `card-templates.js`의 `blue_signal` | 흰 본문 위 주황 점·짧은 선, 초록 구분선, 행사명을 담는 하단 블루 띠. |
| `frame` / 네이비 프레임 | `reference-nameplate/assets/template-frame.png`, `index.html`의 `PLATE_TEMPLATES.frame` | 안쪽 네이비 테두리와 하단 사선 포인트. 원본 이미지의 바깥 투명 영역이나 질감은 복사하지 않고 선 구조를 재구성. |
| `side` / 네이비 사이드 | `reference-mail/assets/templates/navy_gold_frame.png`, `card-templates.js`의 `navy_gold_frame` | 좌측 네이비 패널·골드 구분선과 우측 인적 사항. 명찰에서는 상단 로고 영역을 독립적으로 확보. |

목걸이형과 집게형은 같은 템플릿·입력 체계를 공유하되, 제조사 확인 삽입지 규격과 기본 가로·세로가 다르다. 규격 근거는 `core.js`의 `presets`와 별도 규격 문서를 참조한다.

## 정보 처리

사용자 문구는 DOM `textContent`와 입력 요소의 `value`로만 반영한다. 명단은 페이지 메모리에만 있으며 자동 저장·분석 요청·원격 API 호출이 없다. 명시적 JSON/CSV 다운로드와 파일 선택만 제공한다. CSV 수식 접두문자 보호는 공유 `BadgeCore.toCSV`에서 처리한다. 페이지 CSP는 `connect-src 'none'`이며 외부 분석 스크립트를 불러오지 않는다. 제조사 출처 링크는 사용자가 클릭했을 때만 별도 탭으로 열리고 명단을 전달하지 않는다.
