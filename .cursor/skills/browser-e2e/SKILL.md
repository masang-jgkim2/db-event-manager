---
name: browser-e2e
description: >-
  Runs DQPM Playwright E2E and headed browser tests (login, smoke, register/approve,
  my-dashboard, QA execute modal, product modal). Use when the user asks to test in
  a browser, headed/headless, smoke, e2e, Playwright, probe, dba01, or phrases like
  "브라우저 열어서 테스트", "로그인해서 나의 대시보드", "회원가입부터 승인까지".
---

# DQPM 브라우저 E2E (Playwright)

## 기본 정책 (중요)

| 트리거 | 실행 |
|--------|------|
| UI·관련 API **기능 추가/수정** 완료 | **smoke 헤드리스** (`npm run test:e2e:smoke` 또는 `scripts/run-smoke.ps1`) — 사용자 지시 없이 |
| 사용자가 **headed·브라우저 띄워·눈으로** 명시 | `--headed` / `DQPM_HEADED=1` 만 |

규칙: `.cursor/rules/browser-e2e-smoke.mdc`

## 필수 동작

- **설명만 하지 말고** Shell로 테스트를 실행한다.
- 서버가 이미 떠 있다고 가정한다 (`localhost:5173`, API `4000`). `run-e2e-with-servers.ps1`은 **사용자가 서버 구동 중이면 쓰지 않는다** (포트 kill 위험).
- 실행 후: 통과/실패 요약, 실패 시 `front/test-results/`·`front/scripts/probe-*.png` 참고.
- Headed는 **사용자가 요청한 경우에만** — 사용자 PC에 Chromium이 뜬다고 안내.

## 사전 확인 (짧게)

```powershell
Invoke-WebRequest -Uri http://localhost:4000/api/health -TimeoutSec 5 -UseBasicParsing | Select-Object StatusCode
```

실패하면 서버 기동을 요청하고 테스트는 중단.

## 환경 변수 (PowerShell)

| 변수 | 기본 | 용도 |
|------|------|------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5173` | 프론트 URL |
| `E2E_USER_ID` / `E2E_PASSWORD` | `admin` / `admin123` | admin·메뉴·승인 |
| `E2E_DBA_USER_ID` / `E2E_DBA_PASSWORD` | `dba01` / `dba01` | DBA 대시보드 |
| `DQPM_HEADED` | `1` | probe headed |
| `DQPM_USER` / `DQPM_PASS` | dba01 | probe 계정 |
| `DQPM_BASE` | = PLAYWRIGHT_BASE_URL | probe URL |
| `DQPM_SLOW_MO` | `400` | probe 슬로우 모션 |

사용자가 비밀번호를 주면 **그 세션의 env에 설정** 후 실행. 채팅에 비밀번호 없으면 admin 테스트는 스킵하거나 dba01만 실행.

작업 디렉터리: `front/` (repo: `db-event-manager/front`).

## 사용자 지시 → 실행 매핑

### headed로 dba01/dba01 로그인해서 나의 대시보드까지

```powershell
cd front
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
$env:E2E_DBA_USER_ID = 'dba01'; $env:E2E_DBA_PASSWORD = 'dba01'
$env:DQPM_HEADED = '1'; $env:DQPM_SLOW_MO = '400'
$env:DQPM_BASE = $env:PLAYWRIGHT_BASE_URL
$env:DQPM_USER = 'dba01'; $env:DQPM_PASS = 'dba01'
npx playwright test e2e/my-dashboard-dba.spec.ts --project=smoke --headed --grep "B-07"
```

또는 probe: `node scripts/probe-select-result-ui.mjs` (로그인·대시보드·QA 버튼 있으면 실행까지).

### smoke 테스트 돌려줘 (admin 비밀번호 ○○○)

```powershell
cd front
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
$env:E2E_USER_ID = 'admin'; $env:E2E_PASSWORD = '<사용자 제공>'
$env:E2E_DBA_USER_ID = 'dba01'; $env:E2E_DBA_PASSWORD = 'dba01'
npm run test:e2e:smoke
```

### 회원가입부터 admin 승인까지 e2e

admin 비밀번호 필수.

```powershell
cd front
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
$env:E2E_USER_ID = 'admin'; $env:E2E_PASSWORD = '<사용자 제공>'
npx playwright test e2e/register-approve.spec.ts --project=smoke
```

### localhost QA 쿼리 실행 모달까지 headed

```powershell
cd front
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
$env:E2E_DBA_USER_ID = 'dba01'; $env:E2E_DBA_PASSWORD = 'dba01'
npx playwright test e2e/my-dashboard-dba.spec.ts --project=workflow --headed --grep "QA 실행"
```

또는 `DQPM_HEADED=1` + `node scripts/probe-select-result-ui.mjs`.

### 프로덕트 페이지 모달만 headed

admin 비밀번호 필요.

```powershell
cd front
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
$env:E2E_USER_ID = 'admin'; $env:E2E_PASSWORD = '<사용자 제공>'
npx playwright test e2e/products.spec.ts --project=smoke --headed
```

## npm 스크립트 요약

| 명령 | 용도 |
|------|------|
| `npm run test:e2e:smoke` | @smoke 전체 |
| `npm run test:e2e:smoke:headed` | smoke + 창 |
| `npm run test:e2e:workflow` | QA 실행 모달 등 |
| `npm run test:e2e:ui` | 사용자가 직접 단계별 (수동 체크리스트) |

## 문서 (상세 시만 읽기)

- `front/e2e/HEADED-TEST-CATALOG.md` — 전체 시나리오 ID
- `front/e2e/MANUAL-FULL-WORKFLOW.md` — 가입~LIVE 수동
- `front/e2e/README.md` — 계정·명령

## 결과 보고 형식

```markdown
## E2E 결과
- **명령**: ...
- **URL**: ...
- **통과/실패**: N/M
- **실패 원인**(있으면): 한 줄 + 스크린샷 경로
- **Headed**: 예/아니오 — 창이 이 PC에 떴는지
```

## 주의

- QA/LIVE **실제 DB 실행** 성공은 데이터·쿼리 의존(실패 모달도 정상 동작일 수 있음).
- `register-approve`는 매 실행마다 **새 e2e 아이디** 생성.
- 원격 URL이면 `PLAYWRIGHT_BASE_URL` / `DQPM_BASE`만 변경.
