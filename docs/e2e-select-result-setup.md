# E2E: SELECT 결과셋(`N행 조회`) 검증용 인스턴스

QA 실행 성공 시 `arrResultRows`·`N행 조회` 태그를 headed/probe로 확인하려면 **SELECT만** 포함한 쿼리 템플릿·`qa_requested` 인스턴스가 필요합니다.

## 권장 조건

| 항목 | 값 |
|------|-----|
| 상태 | `qa_requested` |
| 쿼리 | 대상 DB에서 트랜잭션 없이 실행 가능한 단순 SELECT (예: `SELECT 1 AS n`) |
| 담당 DBA | `dba01` (또는 E2E DBA 계정) |

## 수동 준비 (로컬·QA)

1. **쿼리 템플릿** — 프로덕트·DB 접속에 맞는 QA용 SELECT 1문만 등록.
2. **이벤트** — 위 템플릿으로 인스턴스 생성 후 워크플로를 `qa_requested`까지 진행.
3. **headed 확인** — `front`에서 `DQPM_HEADED=1 node scripts/probe-select-result-ui.mjs`  
   또는 나의 대시보드 → QA 실행 → 모달에 **「N행 조회」**·결과 테이블.

## 실패 사례 (#41 등)

- MSSQL `COMMIT TRANSACTION` without `BEGIN` → **쿼리 스크립트** 문제. 앱이 아닌 템플릿/배포 SQL 수정.
- DELETE만 있는 이력 → 결과셋 UI 없음(정상).

## Playwright (선택)

`@workflow` — `my-dashboard-dba.spec.ts`의 **F-04**는 `qa_requested` 행이 있을 때만 QA 모달까지 자동 검증합니다.  
결과셋 컬럼 assert는 환경별로 `E2E_QA_INSTANCE_ID` 지정 후 probe 스크립트 사용을 권장합니다.
