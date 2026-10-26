# 경기대학교 안내문·명찰 에디션

안내문 진입점: `/kyonggi/`. 명찰 진입점: `/kyonggi/lanyard-badge/`, `/kyonggi/clip-badge/`. 기존 루트 한양대 앱 파일과 저장소는 변경하지 않았습니다. 학교 공식 서비스가 아닌 사용자 제작 도구입니다.

## 공식 출처 (2026-10-26 확인)

| 항목 | 공식 출처 | 사용 |
| --- | --- | --- |
| UI 및 시그니처 | https://www.kyonggi.ac.kr/www/contents.do?key=5093 | 국문 좌우조합 원본 PNG |
| 로고 원본 | https://www.kyonggi.ac.kr/site/www/images/contents/key5093_img03.png | `assets/logo.png`, 바이트 그대로 |
| UI 디자인 매뉴얼 | https://www.kyonggi.ac.kr/downloadContentsFile.do?fileNo=839&key=5093 | ZIP 내 `BS_UI.pdf` 시각 검토, BS-03·BS-06 등 |
| 기룡이·색상 규정 | https://www.kyonggi.ac.kr/www/contents.do?key=9819 | 기본형 6종, 정비례 확대·축소 규정 |
| 캐릭터 원본 ZIP | https://www.kyonggi.ac.kr/downloadContentsFile.do?fileNo=1918&key=9819 | `1.png`–`6.png`를 `giryong-1.png`–`giryong-6.png`로 이름만 변경 |
| 수원캠퍼스 주소 | https://www.kyonggi.ac.kr/www/contents.do?key=5146 | (16227) 경기도 수원시 영통구 광교산로 154-42 |
| 서울캠퍼스 주소 | https://www.kyonggi.ac.kr/www/contents.do?key=5147 | (03746) 서울특별시 서대문구 경기대로 9길 24 |

캐릭터 페이지의 HEX `#215292`, `#CAE3F6`, `#389D89`, `#EB7654`, `#F8A68F`, `#F0BEB2`, `#FEF3F2`를 장식 색상에 사용했습니다. `#389D89`는 페이지에 함께 기재된 RGB 숫자와 불일치하므로 명시된 HEX를 따랐습니다. 연한 패널 색상은 주변 배경을 위한 파생색이며 로고나 캐릭터를 재색상하지 않습니다.

## 자산 사용

UI 매뉴얼은 워드마크의 임의 색상·형태 변경, 구성요소 크기/위치 변경, 비정비례 확대, 기울이기, 테두리, 복잡한 패턴 배경을 금지합니다. 공식 PNG 전체를 정비례로 그리며, 원본 색상 및 파일 여백을 보존합니다. 기본 시안은 로고 주변에 빈 공간을 두고 흰 배경을 사용합니다. 공식 로고에는 사용자가 선택한 틴트를 적용하지 않습니다.

현재 기룡이는 현행 캐릭터 페이지에서 확인한 원본만 사용합니다. 구 UI 매뉴얼의 과거 캐릭터는 사용하지 않습니다. 정비례로 확대·축소하며 잘라내기, 좌우반전, 재색상을 하지 않습니다. 공식 ZIP은 페이지 설명상 원본 대비 20% 파일입니다. 5000px 등 큰 출력에서는 자산 자체의 해상도 한계가 있습니다.

안내문 배경 4종과 명찰 디자인 8종은 이 도구에서 만든 구성으로 학교 공식 명함 양식이 아닙니다. 공식 로고를 재구성한 것이 아니며 자산 저작권은 경기대학교에 있습니다. 배포가 포괄적인 상표·저작권 사용 허가를 의미하지 않습니다. 사용자가 이동/확대한 후에도 자산 주변 여백과 요소 간 겹침을 확인해야 합니다.

## 구현과 분리

- 기존 한양대 tracked 파일은 변경하지 않고 kyonggi 전용 사본을 사용합니다. 공통 버그 수정 시 두 에디션 모두 검토해야 합니다.
- 안내문 localStorage: `kyonggi-notice-maker-v1`, JSON app: `kyonggi-notice-maker`. 과거 한양대 저장 키를 읽거나 삭제하지 않습니다.
- 명찰 localStorage: `kyonggi-badge-lanyard-v1`, `kyonggi-badge-clip-v1`. JSON brand: `kyonggi`. 한양대 및 브랜드 없는 프로젝트는 거부합니다.
- 수원·서울 공식 주소 선택 후 직접 수정 가능합니다. 명찰 주소는 선택 표시입니다.
- 로고/캐릭터 원본색과 비율 유지. 안내문의 공식 자산 반전·회전·투명도 변경을 제한합니다. 업로드 사진은 기존 편집 기능을 유지합니다.
- 안내문 GA 및 기존 tool=04 의견 링크 제거. 명찰 feedback 스크립트 미포함. 기존 백엔드 변경 없음.
- 안내문 PNG/PDF 및 명찰 PNG/인쇄 PDF, JSON 저장 복원, CSV/TSV 명단 입력과 mm 정밀 편집 제공.
- 예시 이름은 가상참가자·예시참가자 등입니다.
- html2canvas 1.4.1 (MIT), jsPDF 2.5.1 (MIT)를 전용 로컬 경로에 고정. 라이브러리 파일의 라이선스 헤더 보존.

## 검증 및 배포

2026-10-26 독립 headless Chrome에서 주소 변경·직접 수정·새로고침 복원, 로고/캐릭터 표시 전환, 모든 시안, 긴 문구, PNG 실제 다운로드 및 재열기, PDF 출력, JSON 저장/복원을 검증했습니다. 명찰은 mm 변경, 명단 일괄 입력, 글자 위치·색상·크기 편집도 검증했습니다. PNG의 이미지 비율과 인쇄 PDF는 실제 렌더링을 재열어 확인했습니다.

기존 한양대 명찰 core 30개, browser/print 106개 검증 통과. 기존 한양대 안내문 렌더링 및 tracked 파일 무변경 확인. 오래된 badge-registration 테스트는 자체 고정 baseline 이후의 선행 변경 때문에 2개 실패하며 이번 작업은 해당 파일을 변경하지 않습니다.

두 저장소의 main 커밋에서 `dynamic/pages/pages-build-deployment` 성공 기록을 확인했습니다. main push/merge는 공개 배포를 유발합니다. 2026-10-26 사용자의 별도 명시적 공개 배포 승인 후 PR 병합 진행. Pages/권한 설정은 변경하지 않습니다.

실제 프린터의 물리 치수는 검증할 수 없으므로 명찰의 기존 100mm 자 시험 인쇄 기능을 제공합니다.
