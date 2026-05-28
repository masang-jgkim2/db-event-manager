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

기본값: `admin` / `admin123` (백엔드 시드와 동일)  
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
| smoke + 창 보기 | `npm run test:e2e:smoke:headed` |
| QA 실행 모달 등 | `npm run test:e2e:workflow` |
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
- **helpers/auth.ts** — 공통 로그인
