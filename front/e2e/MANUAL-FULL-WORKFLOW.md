# 수동 체크리스트 — 가입 ~ LIVE 확인 (§I)

Playwright가 대신하지 **않는** 구간입니다. 배포 전·월 1회 **headed**로 따라 하세요.

`npm run test:e2e:ui` → 이 파일을 옆에 두고 진행.

- [ ] **사전** `test:e2e:smoke` 통과 (자동)
- [ ] **사전** 서버·계정: GM, DBA(`dba01`), admin

## 1. 이벤트 생성 (GM)

- [ ] `/query` — SELECT 포함 테스트 이벤트 권장 (`SELECT 1 AS n_test`)
- [ ] 반영 범위 QA+LIVE (또는 LIVE만이면 QA 단계 생략)
- [ ] 제출 → 나의 대시보드에 `event_created`

## 2. 컨펌 (GM → DBA)

- [ ] GM: **컨펌 요청** → `confirm_requested`
- [ ] DBA: **컨펌** → `dba_confirmed`

## 3. QA (GM → DBA → GM)

- [ ] GM: **QA 쿼리 실행 요청** → `qa_requested`
- [ ] DBA: **QA 쿼리 실행** → 성공 시 `qa_deployed`, 모달에 **쿼리별 결과**·`N행 조회`
- [ ] GM: **QA 확인** → `qa_verified`

## 4. LIVE (GM → DBA → GM)

- [ ] GM: **LIVE 쿼리 실행 요청** → `live_requested`
- [ ] DBA: **LIVE 쿼리 실행** → `live_deployed`
- [ ] GM: **LIVE 확인** → `live_verified` (완료)

## 5. 선택 확인

- [ ] 상세 → **진행 이력** — 실행 블록·SELECT 테이블(신규 실행분만)
- [ ] 알림 벨·SSE — 다른 탭에서 상태 변경 시 목록 갱신
- [ ] 재요청 — 필요 시 QA/LIVE 확인 팝업에서 재요청

**실패 시 기록**: 인스턴스 번호, 환경(QA/LIVE), 오류 모달 스크린샷.
