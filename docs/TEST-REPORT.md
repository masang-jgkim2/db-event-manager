# 테스트 결과 보고서

작성일: 2025-03-10

## 0. 자동 API 테스트 (백엔드)

- **실행**: `backend` 디렉터리에서 `npm test`
- **결과**: ✅ **40개 테스트 통과** (Test Suites: 1 passed, Tests: 40 passed)
- **구성**: Jest + ts-jest + supertest, `src/__tests__/api.test.ts`
- **실행**: `npm test` 또는 `npm run test:api` (전체), `npm run test:permission` (권한/역할 관련만)
- **내용**:
  - 헬스, 인증(admin/gm01/dba01), 토큰 검증
  - 역할·권한별 메뉴/페이지 대응 API 매트릭스: admin 전부 200, GM 프로덕트·이벤트·이벤트인스턴스 200·나머지 403, DBA(실행만) 이벤트인스턴스만 200
  - 권한별 API: 프로덕트/이벤트 템플릿/DB 접속(보기만 시 POST·PUT·DELETE·test 403)/사용자·역할(user.view, role.view)/이벤트 인스턴스 실행
  - 권한 추가·삭제 시나리오(재로그인 후 403·200 검증)

---

## 1. 테스트 범위 및 한계

- **자동 테스트**: 백엔드 API 테스트 **있음** (위 0절). 프론트엔드 단위/E2E는 없음.
- **실행한 검증**:
  - 백엔드 `npm test` (20 passed)
  - 백엔드 TypeScript 빌드 (`npm run build`)
  - 프론트엔드 TypeScript + Vite 빌드 (`npm run build`) — 현재 TS 오류로 실패
  - API/페이지 목록 정리 (코드 기준)
- **수행하지 않은 것**: 브라우저에서 직접 클릭·입력하는 수동 테스트, 로그인 후 각 페이지/기능 점검.

---

## 2. 백엔드

### 2.1 빌드

- **결과**: ✅ **성공** (수정 후)
- **조치**: `RoleRepository`, `UserRepository`를 정규화 데이터 레이어(`fnGetRolesWithPermissions`, `fnGetUsersWithRoles`, `fnSaveUserAndRoles` 등)를 사용하도록 수정하여 빌드 오류 해결.

### 2.2 API 목록 (코드 기준)

| 구분 | 메서드 | 경로 | 설명 |
|------|--------|------|------|
| 공통 | GET | `/api/health` | 헬스 체크 |
| 인증 | POST | `/api/auth/login` | 로그인 |
| 인증 | GET | `/api/auth/verify` | 토큰 검증(자동 로그인) |
| 사용자 | GET | `/api/users` | 사용자 목록 (user.view) |
| 사용자(관리자) | POST | `/api/users` | 사용자 추가 |
| 사용자(관리자) | PUT | `/api/users/:id` | 사용자 수정 |
| 사용자(관리자) | DELETE | `/api/users/:id` | 사용자 삭제 |
| 사용자(관리자) | PATCH | `/api/users/:id/password` | 비밀번호 초기화 |
| 역할 | GET | `/api/roles` | 역할 목록 (role.view) |
| 역할(관리자) | POST | `/api/roles` | 역할 추가 |
| 역할(관리자) | PUT | `/api/roles/:id` | 역할 수정 |
| 역할(관리자) | DELETE | `/api/roles/:id` | 역할 삭제 |
| 프로덕트 | GET | `/api/products` | 목록 (product.view 등) |
| 프로덕트 | POST | `/api/products` | 추가 (product.create 또는 manage) |
| 프로덕트 | PUT | `/api/products/:id` | 수정 (product.edit 또는 manage) |
| 프로덕트 | DELETE | `/api/products/:id` | 삭제 (product.delete 또는 manage) |
| 이벤트 템플릿 | GET | `/api/events` | 목록 (event_template.view 등) |
| 이벤트 템플릿 | POST | `/api/events` | 추가 (event_template.create 또는 manage) |
| 이벤트 템플릿 | PUT/DELETE | `/api/events/:id` | 수정/삭제 (event_template.edit/delete 또는 manage) |
| 이벤트 인스턴스 | GET | `/api/event-instances/stream` | SSE 스트림 |
| 이벤트 인스턴스 | GET | `/api/event-instances` | 목록 |
| 이벤트 인스턴스 | GET | `/api/event-instances/:id` | 단건 조회 |
| 이벤트 인스턴스 | POST | `/api/event-instances` | 생성 (instance.create) |
| 이벤트 인스턴스 | PUT | `/api/event-instances/:id` | 수정 (my_dashboard.edit) |
| 이벤트 인스턴스 | PATCH | `/api/event-instances/:id/status` | 상태 변경 |
| 이벤트 인스턴스 | POST | `/api/event-instances/:id/execute` | QA/LIVE 실행 (my_dashboard.execute_qa/live 등) |
| DB 접속 | GET | `/api/db-connections` | 목록 (db_connection.view 또는 db.manage) |
| DB 접속 | POST | `/api/db-connections` | 추가 (db_connection.create 또는 db.manage) |
| DB 접속 | PUT/DELETE | `/api/db-connections/:id` | 수정/삭제 (db_connection.edit/delete 또는 db.manage) |
| DB 접속 | POST | `/api/db-connections/:id/test` | 연결 테스트 (db_connection.test 또는 db.manage) |
| 관리자 | POST | `/api/admin/save-test-seed` | 테스트 시드 저장 (관리자 전용) |

---

## 3. 프론트엔드

### 3.1 빌드

- **결과**: ❌ **실패** (TypeScript 오류 다수)
- **오류 요약**:
  - **권한 타입**: `App.tsx`, `MainLayout.tsx` — `arrPermissions.includes(p)` 등에서 `string`을 `TPermission`으로 사용 (타입 불일치).
  - **테이블 컬럼**: `DbConnectionPage`, `EventPage`, `MyDashboardPage`, `ProductPage`, `RolePage`, `UserPage` — `Table`의 `columns`가 `ColumnType<unknown>` 등으로 추론되어 제네릭 타입과 맞지 않음.
  - **기타**: `SettingsDrawer.tsx` — 미사용 변수 `ColorPalettePreview`; `MyDashboardPage.tsx` — `onClick` 타입, `const` assertion, 미사용 변수 `nIdx`; `UserPage.tsx` — 미사용 import `Divider`.

### 3.2 페이지·라우트 (코드 기준)

| 경로 | 페이지 컴포넌트 | 접근 조건 |
|------|-----------------|-----------|
| `/login` | LoginPage | 비인증 시 (이미 로그인 시 admin → `/`, 그 외 → `/my-dashboard`) |
| `/` | DashboardPage | dashboard.view |
| `/products` | ProductPage | product.view |
| `/events` | EventPage | event_template.view |
| `/users` | UserPage | user.view |
| `/db-connections` | DbConnectionPage | db_connection.view 또는 db.manage |
| `/roles` | RolePage | role.view |
| `/my-dashboard` | MyDashboardPage | 인증만 (공통) |
| `/query` | QueryPage | instance.view 또는 instance.create |
| `*` | DefaultRedirect | admin → `/`, 그 외 → `/my-dashboard` |

---

## 4. 기능 목록 (요약)

- **인증**: 로그인, 토큰 검증, 로그아웃
- **관리자**: 대시보드(전체), 사용자 CRUD·비밀번호 초기화, 역할 CRUD, DB 접속 CRUD·연결 테스트
- **프로덕트/이벤트 템플릿**: 목록·추가·수정·삭제 (권한별)
- **이벤트 인스턴스**: 목록·단건·생성·수정·상태 변경·QA/LIVE 실행, SSE 실시간 알림
- **공통**: 나의 대시보드, 이벤트 생성(쿼리) 페이지, 설정(테마/사이드바 등)

---

## 5. 권장 사항

1. **수동 테스트**: 백엔드(`npm run dev`), 프론트(`npm run dev`) 실행 후 브라우저에서 로그인(admin / gm01 / dba01)으로 각 페이지·역할별 메뉴·API 동작 확인.
2. **프론트 빌드 통과**: 위 TS 오류 수정(권한 타입 단언, 테이블 `columns` 제네릭, 미사용 변수/import 제거 등) 후 `npm run build` 재실행.
3. **자동 테스트 도입**: Jest/Vitest(단위·API), Playwright/Cypress(E2E) 등으로 핵심 API·로그인·주요 페이지 플로우 자동화 검증.

이 문서는 코드와 빌드 결과만을 기준으로 작성되었으며, 실제 화면·UX·권한 동작은 수동 테스트로 확인하는 것이 필요합니다.
