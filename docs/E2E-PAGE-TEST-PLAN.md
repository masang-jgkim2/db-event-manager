# DQPM 페이지별 E2E 테스트 계획 (통합)

**목표**: 모든 화면·버튼을 **사람이 브라우저에서 하는 것처럼** Playwright로 검증한다.  
**이 문서가 E2E의 단일 기준(SSOT)** 이다. 세부 ID·풀 번호·probe 명령은 부록을 참고한다.

| 구분 | 역할 |
|------|------|
| **주 테스트** | Playwright `front/e2e/*.spec.ts` — 로그인·클릭·모달·탭 |
| **보조** | Jest `backend/src/__tests__/` — API 403/200·순수 함수 (브라우저 대체 아님) |
| **CI** | GitHub Actions `e2e-smoke.yml` — `@smoke`만 (`DATA_STORE=json`) |

---

## 실행 (한 줄)

```powershell
# 사람형 전체: smoke + 생성~LIVE확인~삭제 (권장)
.\scripts\run-e2e.ps1 -Profile human -WithServers

# 서버 기동 → 시드 → 전체 playwright → 종료 (레거시)
.\scripts\run-e2e-with-servers.ps1

# smoke만 (서버 이미 떠 있을 때)
cd front && npm run test:e2e:smoke

# workflow만 (시드 후 7단계+LIVE확인+삭제)
cd front && npm run test:e2e:workflow
```

| 프로필 / 명령 | 범위 | 소요 |
|---------------|------|------|
| `run-e2e.ps1 -Profile smoke` | `@smoke` — PR·기능 수정 후 | ~1분 |
| `run-e2e.ps1 -Profile human` | smoke + workflow (삭제 포함) | ~3분+ |
| `npm run test:e2e:workflow` | E-02~E-10 + **E-X3 삭제** serial | ~2분+ |
| `npm run test:e2e:pool` | 풀 `live_verified` 건 삭제만 | ~1분 |
| `npm run test:e2e:ui` | 전체 + 수동 체크리스트 | 가변 |

삭제 스킵: `E2E_SKIP_DELETE=1` (workflow E-X3·pool `@delete` 공통).

계정: `front/e2e/README.md` · `E2E_USER_ID`/`E2E_PASSWORD` (admin), `E2E_DBA_*` (dba01), GM은 `gm01`/`gm01`.

---

## 상태 표기

| 표기 | 의미 |
|------|------|
| 🤖 | Playwright 자동 (`@smoke` / `@workflow` 등) |
| 📋 | 수동만 (`MANUAL-FULL-WORKFLOW.md` 또는 UI 모드) |
| ⬜ | 시나리오 정의됨, 자동화 **미구현** (로드맵) |
| 🔀 | 일부 자동 + 배포 전 사람 확인 |

**카탈로그 ID** (A-01, E-05 …): `front/e2e/HEADED-TEST-CATALOG.md`와 동일 — 신규 시나리오는 ID 한 줄 추가.

---

## 페이지별 시나리오 매트릭스

### 공통 · 인증

| ID | 페이지 | 사람 동작 | 계정 | spec | 상태 |
|----|--------|-----------|------|------|------|
| A-01~04 | `/login` | 화면 요소·로그인·오류·로그아웃 | admin/dba01 | `auth.spec.ts` | 🤖 |
| A-05~09 | `/register`, `/users` | 가입·중복검사·승인 대기·관리자 승인 | 신규/admin | `register-page`, `register-approve` | 🤖 |
| A-10~11 | `/users`, `/register` | 거절·재가입 | admin | — | ⬜ |

### 메뉴 노출 (사이드바)

| ID | 경로 | 보기 권한 | 검증 계정 | spec | 상태 |
|----|------|-----------|-----------|------|------|
| B-01 | `/` | `dashboard.view` | admin | `navigation.spec.ts` | 🤖 |
| B-02 | `/products` | `product.view` | admin | `navigation.spec.ts` | 🤖 |
| B-03 | `/events` | `event_template.view` | admin | `navigation.spec.ts` | 🤖 |
| B-04 | `/db-connections` | `db_connection.view` | admin | `navigation.spec.ts` | 🤖 |
| B-05 | `/users` | `user.view` | admin | `navigation.spec.ts` | 🤖 |
| B-06 | `/roles` | `role.view` | admin | `navigation.spec.ts` | 🤖 |
| B-07 | `/my-dashboard` | `my_dashboard.view` | admin/dba01 | `navigation.spec.ts`, `my-dashboard-dba` | 🤖 |
| B-08 | `/query` | `instance.create` 등 | gm01 | `navigation-gm01.spec.ts` | 🤖 |
| B-09 | `/activity` | `activity.view` | admin | `navigation-dba01-non-ops` (제목만) | ⬜ 본문 |
| B-10 | 사이드바 | 권한 없음 숨김 | guest/제한역할 | — | ⬜ |
| B-gm01 | GM 메뉴 | ops 메뉴 숨김 | gm01 | `navigation-gm01.spec.ts` | 🤖 |
| B-dba01 | DBA 비노출 | products/events/users/roles URL 403 | dba01 | `navigation-dba01-non-ops` | 🤖 |

---

### `/` 대시보드 (`DashboardPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| C-10 | 카드 로드·요약 표시 | admin | `navigation.spec.ts` (진입만) | 🔀 |
| — | 위젯 DnD·리사이즈·저장 | admin | — | ⬜ |

---

### `/products` 프로덕트 (`ProductPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| C-01 | 목록·**새로운 프로덕트** 모달 열기·취소 | admin | `products.spec.ts` | 🤖 |
| C-02 | 등록 저장 (MSSQL/MySQL 타입) | admin | — | ⬜ |
| — | 수정·삭제 | admin | — | ⬜ |

---

### `/db-connections` DB 접속 (`DbConnectionPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| C-03 | 목록·QA/LIVE·종류 필터 | admin/dba | — | ⬜ |
| C-04 | **새로운 접속** 등록 | admin | — | ⬜ |
| C-05 | 연결 테스트 성공/실패 토스트 | admin | — | ⬜ |
| — | 수정·삭제·권한 없을 때 버튼 숨김 | admin | — | ⬜ |

---

### `/events` 쿼리 템플릿 (`EventPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| T-01 | **쿼리 리뷰 요청** → `confirm_requested` | GM | 시드 / 수동 | 🔀 |
| T-02 | **DBA 리뷰 완료** → `dba_confirmed` | dba01 | 시드 / 수동 | 🔀 |
| G-01 | 목록·필터·스테퍼 | GM/admin | — | ⬜ |
| C-07 | 생성·수정·삭제(참조 시 차단) | admin | — | ⬜ |
| G-02 | 연결 인스턴스 → QueryPage 링크 | GM | — | ⬜ |
| G-03 | 활성 인스턴스 참조 시 삭제 400 | admin | — | ⬜ |

---

### `/query` 이벤트 생성 (`QueryPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| D-01 | 템플릿 선택·입력·미리보기 | gm01 | — | ⬜ |
| D-02~03 | 반영 범위 QA+LIVE / LIVE만 | gm01 | — | ⬜ |
| D-04 | 다중 쿼리 세트 | gm01 | — | ⬜ |
| D-05 | 제출 → `event_created` | gm01 | `workflow-qa-live` (beforeAll) | 🤖 |
| D-06 | DEV 태그·템플릿 리뷰 게이트 | gm01 | — | ⬜ |

---

### `/my-dashboard` 나의 대시보드 (`MyDashboardPage`) — **핵심**

| ID | 동작 | 상태 전이 | 계정 | spec | 상태 |
|----|------|-----------|------|------|------|
| E-01 | 생성 행 표시 | `event_created` | gm01 | `workflow-qa-live` | 🤖 |
| E-02 | **수정** | `event_created` | gm01 | `workflow-qa-live` | 🤖 |
| E-05 | **QA 쿼리 실행 요청** | → `qa_requested` | gm01 | `workflow-qa-live` | 🤖 |
| E-06 | **QA 쿼리 실행** (모달) | → `qa_deployed` | dba01 | `workflow-qa-live`, `my-dashboard-dba` | 🤖 |
| E-07 | **QA 확인** | → `qa_verified` | gm01 | `workflow-qa-live` | 🤖 |
| E-08 | **LIVE 쿼리 실행 요청** | → `live_requested` | gm01 | `workflow-qa-live` | 🤖 |
| E-09 | **LIVE 쿼리 실행** | → `live_deployed` | dba01 | `workflow-qa-live` | 🤖 |
| E-10 | **LIVE 확인** | → `live_verified` | gm01 | `workflow-qa-live` | 🤖 |
| E-D1 | DBA **쿼리 수정** | `qa_requested` 등 | dba01 | `workflow-qa-live` | 🤖 |
| E-X1 | **상세** 모달 (이력·처리자) | — | dba01 | `my-dashboard-dba` | 🤖 |
| E-X2 | **숨기기** / 완료·숨김 탭 | — | gm01 | — | ⬜ |
| E-X3 | **삭제**(복원 불가) | `bPermanentlyRemoved` | admin/본인 | `workflow-qa-live`, `workflow-pool-live-delete` | 🤖 |
| E-R1~3 | QA/LIVE **재요청**·롱프레스 | 재전이 | gm01 | — | ⬜ |
| F-02~03 | SELECT 결과 테이블·DML 건수 | 실행 후 | dba01 | `result-ui.spec.ts` | 🤖 |
| F-01,04~08 | 실행 모달·실패·Progress·다중세트 | — | dba01 | probe / — | 🔀·⬜ |

탭: **진행중** / **완료·숨김** · 보기 **테이블/카드** — smoke에서 일부만 커버, 전환은 ⬜.

---

### `/users` 사용자 (`UserPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| A-09 | 승인 대기 탭·승인 | admin | `register-approve` | 🤖 |
| C-09 | 목록·presence 점 | admin | — | ⬜ |
| — | 추가·수정·삭제·비밀번호 초기화 | admin | — | ⬜ |

---

### `/roles` 역할 권한 (`RolePage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| C-08 | 역할 추가·권한 체크박스 저장 | admin | — | ⬜ |
| — | 삭제·시스템 역할 보호 | admin | — | ⬜ |

---

### `/activity` 활동 로그 (`ActivityPage`)

| ID | 동작 | 계정 | spec | 상태 |
|----|------|------|------|------|
| B-09 | 페이지 진입·목록 | admin | `navigation-dba01-non-ops` (제목) | ⬜ |
| — | 필터·SSE 실시간·일괄 삭제 (`activity.clear`) | admin | — | ⬜ |

---

### 레이아웃 공통 (`MainLayout`)

| ID | 동작 | spec | 상태 |
|----|------|------|------|
| H-01 | SSE로 인스턴스 목록 갱신 | — | ⬜ |
| H-02 | 알림 벨·읽음 | — | ⬜ |
| H-03 | Web Push ON/OFF | — | ⬜ |
| H-05 | 테마·재미 모드·UI 설정 재로그인 유지 | `theme-cursor-site.spec.ts` | 🤖 |

---

## 역할별 최소 커버 (누가 어떤 페이지를)

| 역할 | 계정 | 필수 페이지 | 비고 |
|------|------|-------------|------|
| admin | admin | 전체 | CRUD·승인·대시보드 |
| DBA | dba01 | `/my-dashboard`, `/events`(T-02) | 실행·쿼리수정·템플릿 승인 |
| GM | gm01 | `/products`,`/events`,`/query`,`/my-dashboard` | 7단계 요청·확인 |
| 기획자 | planner01 | GM과 유사, QA/LIVE 버튼 **없음** 확인 | `docs/TEST-BY-ROLE.md` |

---

## 자동화 로드맵 (우선순위)

페이지별 **⬜** 를 `@smoke` 또는 `@workflow`로 채운다. Jest API 중복은 축소한다.

| 우선 | 항목 | 이유 |
|------|------|------|
| ~~P0~~ | ~~E-X3 삭제 → workflow 경로~~ | ✅ `workflow-qa-live` E-X3 · `Profile human` |
| P0 | Jest `DATA_DIR` 격리 | `#241` 등 테스트 데이터 오염 방지 |
| P1 | `/db-connections` C-04~05 | 등록·연결테스트 핵심 |
| P1 | `/events` T-01~02 UI (시드 없이) | D1 게이트 |
| P1 | `/activity` 목록·필터 | B-09 |
| P2 | `/roles`, `/users` CRUD | C-08~09 |
| P2 | E-X2 숨기기, E-R 재요청 | 워크플로 예외 |
| P3 | H-01~04 실시간·알림 | 회귀 빈도 낮음 |

완료 시 이 표의 ⬜ → 🤖, `HEADED-TEST-CATALOG.md` 동기화, `front/e2e/*.spec.ts`에 `@smoke` 태그.

---

## Jest (보조 — 이 문서 범위 밖 상세)

| 용도 | 실행 | 비고 |
|------|------|------|
| API 권한 매트릭스 | `cd backend && npm run test:permission` | 브라우저 대체 불가 |
| 단위·유틸 | `npm test` | `queryTemplateItems`, reconcile 등 |
| MySQL 메타 | `RUN_MYSQL_META_TESTS=1 npm run test:mysql-meta` | 전용 DB만 |

**원칙**: 새 기능의 “사람 검증”은 Playwright에 추가. Jest는 403/엣지·순수 로직만.

---

## 관련 문서 (부록)

| 파일 | 내용 |
|------|------|
| [front/e2e/README.md](../front/e2e/README.md) | 실행·계정·env 빠른 참조 |
| [front/e2e/HEADED-TEST-CATALOG.md](../front/e2e/HEADED-TEST-CATALOG.md) | 전체 ID·풀 #152~168·probe·레거시 |
| [front/e2e/MANUAL-FULL-WORKFLOW.md](../front/e2e/MANUAL-FULL-WORKFLOW.md) | 가입~LIVE 수동 체크리스트 |
| [docs/TEST-BY-ROLE.md](./TEST-BY-ROLE.md) | 역할·권한 요약 (API 테스트 안내) |
| [.cursor/rules/browser-e2e-smoke.mdc](../.cursor/rules/browser-e2e-smoke.mdc) | Cursor 에이전트 smoke 규칙 |

**문서 정책**: 페이지·기능 추가 시 **이 파일 매트릭스 한 줄** + (자동화 시) spec + HEADED 카탈로그 ID.
