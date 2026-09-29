# 실제 수신 계약 테스트 자료

- `nameplate-mach-contract.cjs`: https://github.com/erakeun/nameplate-maker 의 `mach-contract.js`, commit `66312c3f480b0339e985c3cf35307f268c455b9c`에서 수정 없이 복사했습니다. 확장자만 Node 테스트 환경에 맞추었습니다.
- `nameplate-changes.cjs`: 같은 저장소와 커밋의 `nameplate-changes.js` 원본입니다. 새 작업파일의 공식 validator와 이후 변경분 처리를 검증합니다.
- `campus-map-building-link.js.txt`: `erica-campus-map` commit `c2d665ea59ff006979725c521142b88602789a5d`에 적용한 건물 링크 확장 6줄입니다. 기존 `BUILDINGS`의 실제 ID만 검색하는 수신 코드입니다.

별도 참조 저장소가 없는 배포 사본에서도 실제 수신 계약 검증을 생략하지 않기 위한 테스트 자료이며, 앱에서 로드하지 않습니다. 새 수신 버전을 적용할 때 원본과 비교하고 출처와 사본을 함께 갱신하세요.
