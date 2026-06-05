# E2E 테스트 (페이지 클릭 테스트)

브라우저에서 실제로 로그인·메뉴 클릭·버튼 클릭을 수행하는 테스트입니다.

## 권장: 서버 자동 기동/종료 (테스트 시에만 서버 켜고, 끝나면 자동 종료)

**프로젝트 루트**에서 다음 스크립트를 실행하면, 백엔드·프론트를 띄운 뒤 테스트를 돌리고 **테스트가 끝나면 서버를 자동으로 끕니다.**

```powershell
.\scripts\run-e2e-with-servers.ps1
```

- 백엔드(4000), 프론트(5173)를 기동 → 준비 대기 → E2E 실행 → **종료 후 두 서버 프로세스 자동 종료**
- 포트 4000/5173이 이미 사용 중이면 기존 프로세스를 먼저 종료한 뒤 진행

## 수동으로 서버 띄우고 테스트하기

1. **백엔드**: `cd backend && npm run dev` (포트 4000)
2. **프론트**: `cd front && npm run dev` (포트 5173; 다른 포트면 `PLAYWRIGHT_BASE_URL` 설정)
3. (최초 1회) `cd front && npx playwright install chromium`
4. **테스트 실행**: `cd front && npm run test:e2e`
5. **테스트가 끝난 뒤 서버는 수동으로 종료** (Ctrl+C 등)

- **UI 모드**: `npm run test:e2e:ui`
- **특정 파일만**: `npx playwright test e2e/auth.spec.ts`
- **헤드풀(브라우저 창 보기)**: `npx playwright test --headed`

## 테스트 계정

기본값: `admin` / `admin123`, `dba01` / `dba01` (`users.json`·init-e2e-passwords와 맞출 것)  
다른 계정으로 돌리려면 환경 변수로 지정:

- `E2E_USER_ID` — 아이디
- `E2E_PASSWORD` — 비밀번호

## 자동 smoke (기능 수정 시 — 에이전트·로컬)

- **Cursor**: `browser-e2e-smoke` 규칙 — `front`·관련 API 수정 후 에이전트가 **헤드리스 smoke** 자동 실행.
- **로컬 계정**: `front/.env.e2e.local` (`.env.e2e.local.example` 복사, gitignore 권장) — admin 비밀번호 등.
- **한 줄 실행**: `npm run test:smoke` (`run-smoke.ps1` — health 확인 후 smoke).

## 하이브리드 (자동 + 수동 체크리스트)

| 용도 | 명령 |
|------|------|
| CI·배포 전 smoke | `npm run test:e2e:smoke` 또는 `npm run test:smoke` |
| Cursor.com UI 셸 | `theme-cursor-site.spec.ts` (@smoke) — `data-dqpm-shell` |
| smoke + 창 보기 | `npm run test:e2e:smoke:headed` |
| QA 실행 모달 등 | `npm run test:e2e:workflow` |
| F-02·F-03 결과 UI | `npm run test:e2e:result-ui` (시드·재기동 필요) |
| 전체 자동 | `npm run test:e2e` |
| **수동** 풀 플로우 | `npm run test:e2e:ui` + [MANUAL-FULL-WORKFLOW.md](./MANUAL-FULL-WORKFLOW.md) |

- **카탈로그(전체 ID)**: [HEADED-TEST-CATALOG.md](./HEADED-TEST-CATALOG.md)
- **수동만**: [MANUAL-FULL-WORKFLOW.md](./MANUAL-FULL-WORKFLOW.md)

### 계정 env

- `E2E_USER_ID` / `E2E_PASSWORD` — admin (승인·메뉴)
- `E2E_DBA_USER_ID` / `E2E_DBA_PASSWORD` — dba01 (나의 대시보드)

## 포함된 시나리오 (Playwright)

- **auth.spec.ts** — 로그인·로그아웃 (`@smoke`)
- **navigation.spec.ts** — 메뉴 이동 (`@smoke`)
- **products.spec.ts** — 프로덕트 모달 (`@smoke`)
- **register-page.spec.ts** — 가입 화면 (`@smoke`)
- **register-approve.spec.ts** — 가입→승인대기→admin 승인→로그인 (`@smoke`, serial)
- **my-dashboard-dba.spec.ts** — DBA 대시보드·상세·QA 실행 모달 (`@smoke` / `@workflow`)
- **navigation-dba01-non-ops.spec.ts** — dba01 이벤트·사용자 메뉴 (`@smoke`, 운영 제외)
- **navigation-gm01.spec.ts** — gm01 메뉴·이벤트 생성·대시보드 (`@smoke`)
- **workflow-qa-live.spec.ts** — E-02·E-D1·E-03~E-10 serial (`@workflow`, config 필요)
- **workflow-pool-live-delete.spec.ts** — 풀 `152-162` LIVE·삭제 (`@pool`, 생성자 gm01/dba01/gm02만)
- **result-ui.spec.ts** — F-02·F-03 (`@result-ui`, 시드 데모 이력)
- **helpers/auth.ts** — 공통 로그인

## E2E SELECT 워크플로 (gm01 + dba01 L3)

```powershell
cd backend
npm run reset-e2e-passwords    # admin·dba01·gm01 비밀번호
npm run seed-e2e-workflow:fresh   # → front/scripts/e2e-workflow-config.json

cd ../front
$env:DQPM_FRESH='1'
node scripts/probe-gm01-dba01-headed-full.mjs   # headed: DQPM_HEADED=1
npm run test:e2e:workflow
```

### E2E 삭제 (단건)

```powershell
$env:E2E_INSTANCE_ID='163'
npx playwright test e2e/workflow-pool-live-delete.spec.ts --project=workflow-pool --grep "@delete" --headed
```

### E2E 다른 프로덕트 풀

```powershell
cd backend
$env:E2E_PRODUCT_ID='2'   # DK온라인
npm run seed-e2e-workflow:fresh

# 콜오브카오스 INSERT
$env:E2E_PRODUCT_ID='3'
$env:E2E_WORKFLOW_KIND='insert'
npm run seed-e2e-workflow:fresh

cd ../front
$env:E2E_INSTANCE_ID='163'
$env:E2E_SLOW_MO='900'
npx playwright test e2e/workflow-qa-live.spec.ts --project=workflow --headed --grep "E-03|E-04|E-05|E-06|E-07|E-08|E-09|E-10"
```

### E2E 생성자·풀 (#152~162 · 출조낚시왕)

- **생성자**: `gm01`, `dba01`, `gm02`만 (`helpers/e2eCreators.ts`)
- **목록·지시 실행**: `e2e/HEADED-TEST-CATALOG.md` **§P** (P-152~P-162 체크리스트)
- **일괄 자동 X** — 사용자 지시 후 해당 `E2E_INSTANCE_ID`만 실행
- **삭제 제외** = 9단계(E-01~E-10: 생성→컨펌→DBA컨펌→QA요청/실행/확인→LIVE요청/실행→완료). 삭제(E-X3)·숨기기 제외 — `HEADED-TEST-CATALOG.md` §「삭제 제외」
- **qa_requested부터**: `npm run test:e2e:pool:no-delete` (E-06~E-10만)

```powershell
$env:E2E_INSTANCE_ID='158'
npm run test:e2e:pool:no-delete -- --headed
```

### F-02·F-03 결과 UI (상세·진행 이력)

```powershell
cd backend
npm run seed-e2e-workflow:fresh
npm run seed-e2e-result-ui    # MySQL INSERT + 인메모리 재로드(E2E_ALLOW_RELOAD=1)
# backend/.env: E2E_ALLOW_RELOAD=1 (또는 run-e2e-with-servers.ps1)

cd ../front
npm run test:e2e:result-ui
```

- UI로 이벤트 생성까지: `DQPM_UI_CREATE=1`
- 인스턴스 고정: `DQPM_WORKFLOW_ID=154` · 신규 생성 끔: `DQPM_FRESH=0`
