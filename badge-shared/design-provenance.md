# MACH 명찰 디자인·자산 출처

확인일: 2026-10-26. 본 문서는 실제로 읽고 확인한 참고 체크아웃과 재사용 자산을 기록한다. 명찰 템플릿은 아래 기존 앱의 디자인 언어를 실제 명찰 삽입지 크기에 맞춰 새로 구성한 HTML/CSS이며, 기존 인쇄용 배경 이미지를 잘라 쓰지 않았다.

## 확인한 네 가지 앱

| 참고 체크아웃 | 확인한 HEAD | 실제 참고 파일·요소 |
| --- | --- | --- |
| `reference-mail` | `14a4b7ebb74bcef8e507c8dab837b14d67104edd` | `index.html`, `card-templates.js`: 한양 블루 이름, 흰 바탕, 골드 룰, 블루 하단 바, 가로 로고와 캐릭터 배치. `assets/chars/`의 하냥이·하이비비 실제 PNG 확인. |
| `reference-notice` | `60020e6519cc9d1fcda79ea5e76ebcadbf7ade6f` | `index.html`: `--blue:#0E4A84`, 템플릿 선택과 실시간 미리보기, 로고 색 반전. `logos/README.txt`, 실제 한양대학교 가로 로고 확인. |
| `reference-signage` | `4352905ad30a279065ee9b47353c65f8807ddfd0` | `index.html`: `--blue:#0E4A84`, 네이비·골드 조합, 단계별 빠른 입력, 상단 MACH 홈 로고. |
| `reference-nameplate` | `63349f1e996358bec900867321dcb1bf25d9450a` | `index.html`: 좌측 설정 / 우측 미리보기 2열, `#f3f5f8` 배경, `#d9e0e8` 경계, `#1f2937` 본문, `#667085` 보조문구, 14px 안팎 패널 모서리, mm 규격, 명단 표, JSON 명시적 저장·불러오기 및 인쇄 흐름. |

참고 체크아웃은 작업 저장소의 형제 디렉터리이며, 런타임 의존성은 아니다. 참조 파일에 있던 외부 폰트 CDN, 자동 저장 또는 기타 앱 기능을 이식하지 않았다.

## 로컬 복사 자산

원본 파일을 수정 없이 복사했다. 색상·비율을 보존하며 CSS로 크기만 조절한다. 모든 이미지 요청은 현재 앱과 같은 정적 사이트에서 이루어진다.

| 앱 내 파일 | 원본 경로 및 체크아웃 | 원본/복사본 SHA-256 |
| --- | --- | --- |
| `assets/hyu.png` | `reference-notice/logos/hyu.png` (`60020e…`) | `11c67169920d4ea24da0910f7b6cc7ca9c1a2d2d78f5d5f726edc5e5ec1ecc32` |
| `assets/hyu-white.png` | `reference-notice/logos/hyu_white.png` (`60020e…`) | `a9b0c8baee93f53a6079829a210513a529d3de6b8c9b52672aacd7b139e2229f` |
| `assets/hanyangi.png` | `reference-mail/assets/chars/hanyangi_01.png` (`14a4b7…`) | `e87907a23a7197256d841832cccbf1fadb3c204b79b0cbed2e8079ef87e79a89` |
| `assets/hibb.png` | `reference-mail/assets/chars/hibibi_01.png` (`14a4b7…`) | `819012d8ef6762f7a4db64a7df35d3d6826cf84fa23e17177fd7d36016979cc8` |
| `assets/mach-selected-A.svg` | `reference-nameplate/assets/mach-selected-A.svg` (`63349f…`) | `4296ab96d8a536418a3aa92c149ce16e3261a7250ae4d9a9b2c012f8c6d68bb8` |

기존 자산의 브랜드 권리나 사용 허가 범위를 새롭게 주장하지 않는다. 출처 체크아웃의 실제 자산을 같은 MACH 도구군의 명찰 용도로 재사용했다.

## 폰트와 색상

- 글꼴 순서: `Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif`. `reference-nameplate/index.html`의 글꼴 스택을 따른다. 로컬에 설치된 글꼴을 사용하며 외부 폰트 요청이나 라이선스가 확인되지 않은 OS 폰트 파일 복사는 하지 않는다. 따라서 기기에 따라 글자 모양이 조금 다를 수 있다.
- 대표 한양 블루: `#0E4A84` (`reference-notice`·`reference-signage`의 실제 CSS 변수).
- 공식 심플의 골드: `#88774F` (`reference-mail/card-templates.js`의 `gold_rule`).
- 일반 UI의 색·경계·입력·인쇄 안내 흐름은 위 명패 앱을 참조하며, 새 템플릿용 보조 네이비 `#123655`, 밝은 블루·보랏빛 면, 스태프 표시용 골드 `#E5B85D`를 추가했다.

## 새 명찰 템플릿

1. **한양 블루**: 블루 상단의 실제 흰 가로 로고, 행사명, 중앙 이름, 얇은 하단 블루 선.
2. **공식 심플**: 흰 배경, 실제 블루 로고, 골드 구분선과 넉넉한 여백.
3. **하냥이**: 실제 `hanyangi_01.png`, 밝은 블루 바탕, 좌측 인적 사항. 세로 규격에서는 캐릭터를 아래로 배치.
4. **HiBB**: 실제 `hibibi_01.png`, 밝은 보랏빛 바탕. 같은 입력 흐름과 세로 배치 대응.
5. **행사·스태프**: 네이비 배경과 골드 역할 표기. 입력한 직책·역할을 표시하며 임의의 역할을 명단에 추가하지 않음.

목걸이형과 집게형은 같은 템플릿·입력 체계를 공유하되, 제조사 확인 삽입지 규격과 기본 가로·세로가 다르다. 규격 근거는 `core.js`의 `presets`와 별도 규격 문서를 참조한다.

## 정보 처리

사용자 문구는 DOM `textContent`와 입력 요소의 `value`로만 반영한다. 명단은 페이지 메모리에만 있으며 자동 저장·분석 요청·원격 API 호출이 없다. 명시적 JSON/CSV 다운로드와 파일 선택만 제공한다. CSV 수식 접두문자 보호는 공유 `BadgeCore.toCSV`에서 처리한다. 페이지 CSP는 `connect-src 'none'`이며 외부 분석 스크립트를 불러오지 않는다. 제조사 출처 링크는 사용자가 클릭했을 때만 별도 탭으로 열리고 명단을 전달하지 않는다.
