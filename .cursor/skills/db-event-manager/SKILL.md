---
name: db-event-manager
description: DB Event Manager 프로젝트 전체 컨텍스트. 이 프로젝트에서 신규 기능 구현, 버그 수정, 코드 리뷰 요청 시 사용. 백엔드(Node/Express/TS), 프론트(React/Vite/TS/AntD), 인메모리 DB, MSSQL/MySQL 쿼리 실행, RBAC, SSE 실시간 업데이트를 다룬다.
---

# DB Event Manager — 프로젝트 컨텍스트

## 기술 스택

| 영역 | 스택 |
|------|------|
| 백엔드 | Node.js, Express, TypeScript, JWT, bcryptjs, Zod |
| 프론트엔드 | React, Vite, TypeScript, Ant Design, Zustand, Axios, React Router DOM |
| DB 드라이버 | mssql (주), mysql2/promise |
| 실시간 | Server-Sent Events (SSE) |
| 데이터 | 인메모리 (→ 추후 DB 마이그레이션, Repository 패턴 적용됨) |

## MSSQL / MySQL 이중 실행

- **실행 진입점**: `fnExecuteQueryWithText`만 사용 (`queryExecutor.ts`). `strDbType`으로 드라이버 분기, 풀은 접속 `nId`별 캐시.
- **접속 선택**: `fnResolveExecuteConnection(nProductId, strEnv, nDbConnectionId?)` — 세트 1개여도 `nDbConnectionId`로 템플릿 연결과 동일 규칙 적용; ID 없으면 **GAME** 종류 활성 접속. `fnFindActiveConnection`(종류 무관·첫 건)은 비결정적이므로 실행 경로에서 사용하지 않음.
- **접속 등록**: `products.strDbType`(mssql/mysql)과 접속의 `strDbType`이 **일치**해야 함 (`dbConnectionController`).
- **시스템 DB**: `db/systemDb.ts`는 마이그레이션용 **MSSQL 전용**. 타깃 게임 DB 실행과 별개.
- **DB 스키마 정합성**: `docs/SCHEMA-DATA-REVIEW.md` (인메모리/타입 vs `docs/schema.sql`).
- **MSSQL 암호화**: `dbManager`가 `options.encrypt` 설정. `.env`에 **`MSSQL_ENCRYPT=false`** 이면 비암호화 TDS(구 SQL Server 등). 미설정 시 암호화 사용. 백엔드 `index.ts`는 **`import 'dotenv/config'`** 로 `.env` 선로드.

## 핵심 도메인

- **이벤트 인스턴스**: 9단계 워크플로 (event_created → … → live_verified). **재요청** 전이: qa_verified→qa_requested, live_deployed/live_verified→live_requested.
- **쿼리 실행**: 이벤트 아이템/퀘스트 데이터를 DEV/QA/LIVE DB에 반영
- **RBAC**: 동적 역할/권한 (admin, dba, game_manager, game_designer + 커스텀)
- **실시간 업데이트**: SSE로 인스턴스 상태 변경을 즉시 반영
- **쿼리 실행 Progress**: `GET .../template-exec-elapsed`로 마지막 성공 `nElapsedMs` 조회 → 프론트에서 그 시간에 맞춰 0→99% 선형(rAF), 다중 세트는 SSE 진행률과 `max` (`templateExecElapsed.ts` 인메모리). DB화 시 영속화.

## 주요 파일 위치

- **나의 대시보드 위젯·레이아웃 스펙**: `docs/DASHBOARD-LAYOUT-SPEC.md`
- **레이아웃 타입·기본값**: `front/src/types/dashboardLayout.ts`, `front/src/constants/dashboardLayoutDefault.ts`

```
backend/src/
  controllers/eventInstanceController.ts  # 워크플로·재요청 전이 + 실행 로직
  services/queryExecutor.ts               # SQL 파싱 + 트랜잭션 실행
  services/sseBroadcaster.ts              # SSE 클라이언트 관리
  db/dbManager.ts                         # 커넥션 풀
  data/roles.ts                           # 인메모리 역할/권한
  middleware/permissionMiddleware.ts     # 권한 검사

front/src/
  pages/DashboardPage.tsx                 # 이벤트 메뉴 대시보드 (숫자·테이블·맞춤 카드 multi-row, DnD·리사이즈·localStorage)
  pages/MyDashboardPage.tsx              # 나의 대시보드 (실행 Progress·SSE; SQL 복사: copy이벤트 setData→execCommand→writeText+readText 검증, onMouseDown preventDefault 비권장)
  pages/QueryPage.tsx                     # 이벤트 생성
  components/AppTable.tsx                 # 테이블 (리사이즈·드래그·더블클릭 자동맞춤, No.컬럼)
  components/RequestWithLongPressButton.tsx  # 재미 모드 시 롱프레스 재요청
  components/SettingsDrawer.tsx          # 굳굳 설정 (재미 모드 스위치)
  stores/useEventInstanceStore.ts         # 인스턴스 상태 관리
  stores/useThemeStore.ts                 # bFunMode 등 테마/설정
  hooks/useEventStream.ts                 # SSE 연결 훅
  components/MainLayout.tsx               # 사이드바 + 메뉴 권한(보기 권한만으로 노출)
  types/index.ts                          # ARR_PERMISSION_GROUPS, 권한 라벨(역할 권한 화면)
```

## 권한·메뉴 (세분화)

- **원칙**: 모든 메뉴/페이지는 해당 **보기 권한** 필수. 없으면 메뉴 비노출·직접 URL 403.
- **메뉴명**: 대시보드, **프로덕트**, **이벤트 템플릿**, DB 접속 정보, **사용자**, **역할 권한**, 나의 대시보드, 이벤트 생성.

**권한 종류 (요약)**

| 도메인 | 보기 | 생성/수정/삭제/기타 |
|--------|------|---------------------|
| 프로덕트 | product.view | product.create / edit / delete |
| 이벤트 템플릿 | event_template.view | event_template.create / edit / delete |
| DB 접속 | db_connection.view | db_connection.create / edit / delete / test |
| 사용자 | user.view | user.create / edit / delete / reset_password |
| 역할 | role.view | role.create / edit / delete / edit_permissions |
| 나의 대시보드 | my_dashboard.view(보기) | detail, edit, request_confirm, query_edit, confirm, request/execute/verify QA·LIVE, hide, **delete_instance**(삭제·진행 중 포함·복원 불가) 등 |
| 이벤트 생성 | instance.view | instance.create |

- **나의 대시보드**: 상세 → `my_dashboard.detail`, 수정 → `my_dashboard.edit`, 컨펌 요청 → `my_dashboard.request_confirm`, 숨김 → `my_dashboard.hide`, 삭제(라벨) → `my_dashboard.delete_instance`(또는 레거시 `my_dashboard.delete`·로그인 확장), 진행 중 이벤트도 가능, 서버 `bPermanentlyRemoved`·복원 없음. `instance.create`는 이벤트 수정/컨펌을 자동 부여하지 않음.
- **이벤트 생성 페이지**: 진입은 `instance.view` 또는 `instance.create`; 제출 버튼은 `instance.create`만.

## 반영 날짜 검증 규칙

- DEV/QA: `현재시간 < dtDeployDate` 이어야 실행 허용
- LIVE: `현재시간 >= dtDeployDate` 이어야 실행 허용

## 인메모리 데이터 위치

`backend/src/data/` — 추후 `backend/src/repositories/` 패턴으로 DB 교체 예정.
스키마는 `docs/schema.sql` · 정규화는 `docs/schema_normalized.sql` · 코드/JSON과의 차이는 `docs/SCHEMA-DATA-REVIEW.md` 참조.
