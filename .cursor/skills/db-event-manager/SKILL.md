---
name: db-event-manager
description: Database Query Process Manager(DQPM) 프로젝트 전체 컨텍스트. 이 프로젝트에서 신규 기능 구현, 버그 수정, 코드 리뷰 요청 시 사용. 백엔드(Node/Express/TS), 프론트(React/Vite/TS/AntD), 인메모리 DB, MSSQL/MySQL 쿼리 실행, RBAC, SSE 실시간 업데이트를 다룬다.
---

# Database Query Process Manager (DQPM) — 프로젝트 컨텍스트

## 기술 스택

| 영역 | 스택 |
|------|------|
| 백엔드 | Node.js, Express, TypeScript, JWT, bcryptjs, Zod |
| 프론트엔드 | React, Vite, TypeScript, Ant Design, Zustand, Axios, React Router DOM |
| DB 드라이버 | mssql (주), mysql2 (메타·MySQL 5+), mysql@2.18 (게임 DB 4.x) |
| 실시간 | Server-Sent Events (SSE) |
| 데이터 | 인메모리 + 선택 `DATA_STORE=mysql` 시 메타만 정규화 MySQL (`product`, `users`, … / `mysqlRelationalSync.ts`) |

- **개발·preview API**: Vite `server`/`preview`의 `/api` 프록시 → `VITE_PROXY_TARGET`(기본 `http://127.0.0.1:4000`). `axiosInstance`는 **상대 경로 `/api/...`만** 사용(호스트·포트 혼선 방지). `main.tsx` 개발 시 `fetch('/api/health')`로 연결 확인 로그. **SSE·스트리밍 fetch**는 `fnBuildSseApiUrl` — 프록시 SSE 버퍼링 회피 위해 페이지와 동일 호스트·`VITE_SSE_PORT`(기본 4000)로 직접 연결.
- **`.env` 로드**: `src/loadEnv.ts`가 `backend/.env` 절대경로로 `dotenv.config` — `cwd`가 repo 루트여도 동일. `app.ts`·`index.ts`보다 먼저 import(호이스트로 `ACTIVITY_LOG_ENABLED` 등이 늦게 먹는 문제 방지).
- **Windows 로컬 스크립트(저장소 루트)**: `start.bat`·`stop.bat`(배치는 ASCII만 — cmd UTF-8 깨짐 방지), `kill-dev-ports.bat` — `4000`·`5173` LISTEN 프로세스 강제 종료.

## MSSQL / MySQL 이중 실행

- **실행 진입점**: `fnExecuteQueryWithText`만 사용 (`queryExecutor.ts`). `strDbType`으로 드라이버 분기, 풀은 접속 `nId`별 캐시.
- **접속 선택**: `fnResolveExecuteConnection(nProductId, strEnv, nDbConnectionId?, strServiceAbbr?)` — 인스턴스 Step2 `strServiceAbbr`로 서비스 전용→공통 fallback. 세트 1개여도 `nDbConnectionId`+서비스+kind; ID 없으면 **GAME**. `fnFindActiveConnection`(종류 무관·첫 건)은 비결정적이므로 실행 경로에서 사용하지 않음.
- **접속 등록**: `products.strDbType`(mssql/mysql)과 접속의 `strDbType`이 **일치**해야 함. 키: **프로덕트 + strServiceAbbr(서비스 구분, 선택) + env + kind + host + DB명**. DK/KR·DK/G 등 서비스별 QA/LIVE가 다르면 `strServiceAbbr` 지정. 비우면 공통 fallback.
- **DB 접속 저장 성능**: MySQL 모드에서 `fnCommitOneDbConnectionToMysql` 1행만 반영 — `fnAwaitMysqlDocFlush`/전체 `fnRelationalWriteFullFromMemory` 대기 금지.
- **시스템 DB**: `db/systemDb.ts`는 마이그레이션용 **MSSQL 전용**. 타깃 게임 DB 실행과 별개.
- **DB 스키마 정합성**: `docs/SCHEMA-DATA-REVIEW.md` (인메모리/타입 vs `docs/schema.sql`).
- **data JSON ↔ 모듈 ↔ 시드·중복**: `docs/DATA-JSON-MAP.md`
- **메타 영속 MySQL**: `docs/DATA-BACKEND-MYSQL.md` (`DATA_STORE`, `DATA_MYSQL_*`). DDL `backend/src/db/mysqlAppSchema.ts` = `docs/dqpm_meta_relational_schema.sql`. 적재·하이드레이트·스냅샷 `mysqlRelationalSync.ts`, `npm run import-json-to-mysql`. **런타임 소스**=메모리, **영속**=MySQL, **JSON 미러**=즉시 디스크(재기동·조사용). 인스턴스 CUD는 **`await fnCommitEventInstancesToStore()`** — `event_instance*`만 치환(`fnRelationalReplaceEventInstancesOnly`); 전체 `fnRelationalWriteFullFromMemory`와 분리. **기동 reconcile**(`fnReconcileMetaJsonWithMysql`): 미러 병합 시 **roles** 포함; **user_roles**는 user·role FK 없으면 스킵; `DATA_MYSQL_SKIP_JSON_RECONCILE=1` 생략; 수동 `npm run reconcile-meta-json-mysql`. **템플릿 스텁**은 JSON 전체 임포트 시에만(`bAllowStubTemplates`); 일상 flush·삭제 후에는 스텁 없음. **템플릿 삭제** 시 활성 인스턴스 참조면 400, 영구삭제만 참조 시 해당 인스턴스 정리 후 `fnAwaitMysqlDocFlush`.
- **MSSQL 암호화**: `dbManager`가 `options.encrypt` 설정. `.env`에 **`MSSQL_ENCRYPT=false`** 이면 비암호화 TDS(구 SQL Server 등). 미설정 시 암호화 사용. 백엔드 `index.ts`는 **`import 'dotenv/config'`** 로 `.env` 선로드.
- **MySQL 실행**: `queryExecutor`의 MySQL 경로는 **`connection.query()`** (텍스트 프로토콜). `execute()`(prepared)는 `USE`/`SET SESSION` 등과 호환되지 않아 HeidiSQL과 결과가 달라질 수 있음.

## DB 접속 정보 — 에이전트 조사·구현 (재발 방지)

1. **메타 vs 게임 분리**: `DATA_MYSQL_*` ≠ 화면 접속 행. 연결 테스트 실패를 메타 `.env`만으로 설명하지 말 것.
2. **`''@IP (Using password: NO)`** + Heidi 성공 → `mysqlServerProbe`(4.0.x) → `mysqlGameConnection` 레거시. 풀 캐시·GRANT는 그 다음.
3. **저장**: `fnCommitOneDbConnectionToMysql` 1행 UPSERT. `DELETE FROM db_connection` 전체·`fnAwaitMysqlDocFlush` 금지. FK는 **삭제** 시만.
4. **중복 등록**: 프로덕트+서비스(선택)+env+kind+host+DB명 — host+DB명까지 같을 때만 409.
5. 규칙 상세: `.cursor/rules/domain-db-connection.mdc`

## 회원 가입·승인 (Phase A)

- **공개** `POST /api/auth/register` → `pending_approval` + `guest` → 로그인·JWT **차단** (`fnGetUserLoginBlock`).
- **관리자** `PATCH /api/users/:id/approve|reject` — `user.approve`|`user.manage`; 승인 시 역할 교체(guest 제외).
- **기동** `onboardingBootstrap.ts` — guest·admin `user.approve` 보정. **제한**: 거절 계정 동일 아이디 재가입 불가, 이메일 인증 미구현.
- 규칙: `.cursor/rules/domain-user-registration.mdc` · 문서 `docs/USER-REGISTRATION-*.md`

## 핵심 도메인

- **쿼리 템플릿**: 3단계 (`template_created` → `confirm_requested` → `dba_confirmed`). **D1**: `dba_confirmed`만 `QueryPage`·`POST /api/event-instances` 허용. 전이 `PATCH /api/events/:id/status`. **D2**: 승인 후 `PUT /api/events/:id`로 쿼리·세트 변경 시 `confirm_requested` 자동 전이. 리뷰 대기 중 DBA 쿼리 수정은 `PUT /api/events/:id/query` + `objQueryEdit` 로그 (`EventPage`).
- **이벤트 인스턴스**: **7단계** (`event_created` → qa_* → live_* → `live_verified`). 템플릿 컨펌은 인스턴스에 없음(D7: 레거시 confirm/dba → `event_created`). **재요청**: qa_verified→qa_requested, live_deployed/live_verified→live_requested.
- **쿼리 실행**: QA/LIVE는 `fnResolveExecuteConnection(..., strServiceAbbr)`(단일·다중 세트·kind별). `QueryPage`·`fnCreateInstance`에서 서비스·종류별 접속 검증. 실패 시 상태 유지 + `arrStatusLogs`에 오류·접속 요약 기록; 성공 이력에 선택 `strConnectionSummary`.
- **RBAC**: 동적 역할/권한 (admin, dba, game_manager, game_designer + 커스텀). 검증 성공 후 `authMiddleware`에서 사용자·역할 테이블 기준 `arrPermissions` 재계산(옛 JWT와 역할 변경 불일치 완화).
- **실시간 업데이트**: SSE로 인스턴스 상태 변경을 즉시 반영; 사용자 목록 접속은 `GET /api/users/presence-stream` + `user_presence`/`presence_snapshot`. 온라인은 인증 요청마다 `fnTouchUserPresence`, **로그아웃(`POST /api/auth/logout`)은 `fnMarkUserOffline`으로 즉시 오프라인 SSE**(`authController`); 로그아웃 요청에는 `authMiddleware`에서 터치 생략. 탭 종료 등은 `userPresence.ts` 스윕·`USER_ONLINE_WINDOW_MS`(기본 30초)로만 소멸.
- **UI 설정 동기화**: `dbem:u{nUserId}:` + `GET`/`PUT /api/auth/ui-preferences` — `DATA_STORE=json`이면 `userUiPreferences.json`, **mysql**이면 `user_ui_preference`(+ 변경 시 전체 메타 스냅샷과 별도 경량 치환)
- **Web Push 구독**: `GET/POST/DELETE /api/push/*` — json=`notificationSubscriptions.json`(레거시 `pushSubscriptions.json` 1회 이관), **mysql**=`notification_subscription`. ON/OFF는 `user_ui_preference` 키 `db-event-manager-web-push-enabled`. VAPID는 `.env`만.
- **인앱 알림 목록**: **mysql**=`user_notification` + `GET/PATCH /api/notifications`·SSE `notification_appended`; **json**은 브라우저 `localStorage`만. 1순위 적재 조건은 `eventInstanceNotificationEligibility`·프론트 `fnShouldNotifyEventInstanceProgress` 동일. **DBA 쿼리 직접 수정**(strStatus 불변)은 `fnBroadcastInstanceUpdate(_, false)`로 «상태 변경» 인앱·Web Push만 생략(중복 노트 완화).
- **쿼리 실행 Progress**: `GET .../template-exec-elapsed`로 마지막 성공 `nElapsedMs` 조회 → 프론트에서 그 시간에 맞춰 0→99% 선형(rAF), 다중 세트는 SSE 진행률과 `max` (`templateExecElapsed.ts` 인메모리). DB화 시 영속화.

## 주요 파일 위치

- **브라우저 E2E (에이전트)**: `.cursor/skills/browser-e2e/SKILL.md` · 규칙 `browser-e2e-smoke.mdc` · **통합 계획** `docs/E2E-PAGE-TEST-PLAN.md`
  - **smoke** (`npm run test:e2e:smoke`): auth·navigation·products·register-*·`navigation-dba01-non-ops`·`navigation-gm01`(gm01)·`my-dashboard-dba`
  - **workflow** (`npm run test:e2e:workflow`): `e2e/workflow-qa-live.spec.ts` only — E-02·E-D1·E-05~E-10 `describe.serial` (gm01+dba01 §I; 템플릿 승인은 시드·EventPage)
  - **시드**: `backend` — `reset-e2e-passwords`, `seed-e2e-workflow:fresh`, `seed-e2e-result-ui`(F-02/F-03 데모 이력) → `e2e-workflow-config.json`
  - **headed probe**: `front/scripts/probe-gm01-dba01-headed-full.mjs` (`DQPM_FRESH=1`, `DQPM_HEADED=1`), 공통 `probe-workflow-lib.mjs`
  - **카탈로그**: `front/e2e/HEADED-TEST-CATALOG.md` · `front/e2e/README.md`
- **나의 대시보드 위젯·레이아웃 스펙**: `docs/DASHBOARD-LAYOUT-SPEC.md`
- **쿼리 템플릿 단일·다중 세트 로직**: `docs/QUERY-TEMPLATE-QUERY-LOGIC.md`
- **인앱 알림 목록(설계·검토)**: `docs/NOTIFICATIONS-DESIGN.md`
- **레이아웃 타입·기본값**: `front/src/types/dashboardLayout.ts`, `front/src/constants/dashboardLayoutDefault.ts`
- **Cursor 스타일 UI**: `design-system.ts` (`OBJ_CURSOR_NEUTRAL`, `objShell`), `MainLayout.tsx` · primary 기본 `STR_PRIMARY_CURSOR_NEUTRAL` `#434343` («Cursor»), 브랜드 `#f54e00` («브랜드 오렌지») · `docs/CURSOR-UI-AUDIT.md`

```
backend/src/
  controllers/eventInstanceController.ts  # 워크플로·재요청 전이 + 실행 로직
  controllers/eventController.ts          # 쿼리 템플릿 CRUD·PATCH status·PUT /query(DBA)·D2 재승인·삭제 시 참조 검사
  data/events.ts                          # fnNormalizeEventTemplate·fnIsTemplateReadyForInstance (D1)
  services/queryExecutor.ts               # SQL 파싱 + 트랜잭션 실행
  services/sseBroadcaster.ts              # SSE 클라이언트 관리 + `user_presence` 브로드캐스트
  services/userPresence.ts                # 접속 터치·fnMarkUserOffline·스윕·스냅샷
  data/userUiPreferences.ts               # 사용자별 UI — json=`userUiPreferences.json`, mysql=`user_ui_preference`
  data/notificationSubscriptions.ts       # Web Push 구독 — json=`notificationSubscriptions.json`, mysql=`notification_subscription`
  data/userNotifications.ts               # 인앱 알림 — mysql=`user_notification`만( json은 프론트 localStorage)
  controllers/userUiPreferencesController.ts
  controllers/notificationsController.ts
  services/inAppNotificationNotifier.ts   # SSE 연동 인앱 알림 적재·`notification_appended`
  services/webPushService.ts              # VAPID·구독 조회·전송
  db/dbManager.ts                         # 게임 DB 연결 테스트·MSSQL 풀
  db/mysqlGameConnection.ts               # 게임 MySQL 풀(mysql2 / 4.x 레거시)
  db/mysqlServerProbe.ts                  # TCP 핸드셰이크로 MySQL 버전(4.x 판별)
  db/mysqlAppSchema.ts                  # 메타 MySQL 정규화 DDL (`product`, `users`, …)
  db/mysqlRelationalSync.ts             # 메타 JSON 동등 ↔ 테이블 적재·로드·전체 스냅샷
  db/mysqlAppDataAccess.ts              # 스키마 보장·파일명별 로드 래퍼
  db/mysqlDocPersist.ts                 # 전체 플러시·`fnScheduleMysqlEventInstanceReplace`·`fnAwaitMysqlEventInstanceFlush`
  data/eventInstances.ts                # `fnCommitEventInstancesToStore` — 미러+event_instance* 치환
  data/metaJsonMysqlReconcile.ts        # JSON 미러 ↔ MySQL 병합(기동·CLI)
  data/bootstrapDataStore.ts            # 기동 하이드레이트·reconcile
  data/roles.ts                           # 인메모리 역할/권한
  data/activityLogs.ts                    # HTTP 활동 로그(메모리+배치 JSON, `fnFlushActivityLogsToDisk`)
  middleware/permissionMiddleware.ts     # 권한 검사

front/src/
  pages/DashboardPage.tsx                 # 이벤트 메뉴 대시보드 (… DnD·리사이즈·계정 스코프 저장소 `fnScopedStorage*`)
  types/eventDashboardCustom.ts           # 맞춤 카드 스키마(ICustomEventDashboardCard·strSummaryGroupKey·ICustomDashboardEventGroup)
  pages/MyDashboardPage.tsx              # 나의 대시보드 (실행 Progress·SSE; 실행 결과 모달: nSetIndex/Total 있으면 쿼리 세트 N 결과로 그룹; SQL 복사 패턴 동일)
  pages/EventPage.tsx                     # 쿼리 템플릿 CRUD (/events) — 목록 서비스 구분 컬럼·연결 DB picker
  pages/QueryPage.tsx                     # 이벤트 생성 (Step2 서비스 구분·Step4 접속 미리보기·payload nProductId)
  utils/countryPlatformLabel.ts           # STR_SERVICE_SCOPE_LABEL·약자/리전 포맷
  utils/dbConnectionScope.ts              # 접속 범위 검증·템플릿 picker·fnListTemplateServiceScopeAbbrs
  components/AppTable.tsx                 # 테이블 (리사이즈·드래그·더블클릭 자동맞춤, 번호 컬럼 fnMakeIndexColumn — 기본 PK nId)
  components/RequestWithLongPressButton.tsx  # 재미 모드 시 롱프레스 재요청
  components/SettingsDrawer.tsx          # 굳굳 설정 (Web Push·재미 모드)
  components/NotificationBellDropdown.tsx # 헤더 인앱 알림
  stores/useNotificationStore.ts          # 인앱 알림 persist( json )·서버 pull 병합( mysql )
  services/notificationSync.ts            # `GET/PATCH /api/notifications`·`fnPullInAppNotificationsForUser`
  api/notificationsApi.ts
  api/pushApi.ts
  stores/useEventInstanceStore.ts         # 인스턴스 상태 관리
  stores/useThemeStore.ts                 # persist `skipHydration` + `dbem:u{nId}`/`guest` 버킷, 변경 시 UI 동기화 푸시
  utils/userScopedStorage.ts              # `dbem:u{nUserId}:논리키`, 레거시 키 1회 이관
  services/userUiPreferencesSync.ts      # 로그인 후 pull·디바운스 push
  api/userUiPreferencesApi.ts
  api/eventInstanceApi.ts                 # `fnApiGetInstances` filter별 in-flight GET 공유
  config/loginUi.ts                       # `VITE_SHOW_LOGIN_DEFAULT_ACCOUNT_HINT` — 로그인 admin 안내
  hooks/useEventStream.ts                 # SSE 연결 훅
  hooks/useUserPresenceStream.ts          # 사용자 접속 SSE
  pages/UserPage.tsx                      # 연결 점 + presence·승인 대기 탭(approve/reject)
  pages/RegisterPage.tsx                  # 공개 가입(사내 이메일)
  controllers/registrationController.ts   # register·check-register
  services/onboardingBootstrap.ts         # guest·user.approve 기동 보정
  styles/design-system.ts                 # Cursor 톤 토큰·Ant components·objShell
  styles/DesignSystemContext.tsx
  components/MainLayout.tsx               # Cursor 셸(라이트 사이드바·48px 헤더)·메뉴 권한
  types/index.ts                          # TPermission(백엔드와 동일 유니온), OBJ_PERMISSION_LABELS, ARR_PERMISSION_GROUPS
```

## 권한·메뉴 (세분화)

- **TPermission 타입 동기**: `front/src/types/index.ts`의 `TPermission`·`OBJ_PERMISSION_LABELS`는 백엔드 `backend/src/types/index.ts` 권한 유니온과 **동일**하게 유지(JWT `arrPermissions` 전부). 신규·변경 권한 시 양쪽 갱신.
- **원칙**: 모든 메뉴/페이지는 해당 **보기 권한** 필수. 없으면 메뉴 비노출·직접 URL 403.
- **메뉴명**: 대시보드, **프로덕트**, **쿼리 템플릿**, DB 접속 정보, **사용자**, **역할 권한**, **활동**(`activity.view`), 나의 대시보드, 이벤트 생성.

**권한 종류 (요약)**

| 도메인 | 보기 | 생성/수정/삭제/기타 |
|--------|------|---------------------|
| 프로덕트 | product.view | product.create / edit / delete |
| 쿼리 템플릿 | event_template.view | event_template.create / edit / delete / **request_confirm** / **confirm** |
| DB 접속 | db_connection.view(목록·「연결」열) | create / edit / delete / test(연결 테스트 API·자동 점검; `db.manage` 시 전부) |
| 사용자 | user.view | user.create / edit / delete / reset_password / **approve**(가입 승인·거절) |
| 역할 | role.view | role.create / edit / delete / edit_permissions |
| 활동 | activity.view (`GET /api/activity/logs` 등) | activity.clear (`DELETE /api/activity/logs` 전체 삭제) |
| 나의 대시보드 | my_dashboard.view(보기) | detail, edit, query_edit, request/execute/verify QA·LIVE, hide, **delete_any** 등 (레거시 `request_confirm`/`confirm` → `event_template.*` expand) |
| 이벤트 생성 | instance.view | instance.create, **delete_own**(본인 작성 이벤트만 영구 삭제) |

- **나의 대시보드**: 삭제는 `my_dashboard.delete_any`(타인 포함) 또는 `instance.delete_own`+본인 작성 건만. 레거시 `my_dashboard.delete`/`delete_instance`는 로그인 시 `delete_any`로 확장. 서버 `bPermanentlyRemoved`·복원 없음. `instance.create`는 이벤트 수정을 자동 부여하지 않음. 인스턴스 컨펌 단계 없음 — 템플릿 승인은 `EventPage`.
- **이벤트 생성 페이지**: 진입 `instance.view`|`instance.create`; 제출 `instance.create`만. 템플릿 선택·제출은 **`dba_confirmed`만** (미승인 건은 쿼리 템플릿 메뉴에서 리뷰·승인).

## 반영 날짜 검증 규칙

- QA : `dtQaDeployDate` 있으면 `현재시간 >= dtQaDeployDate` 이어야 실행 허용 (없으면 제한 없음)
- LIVE: `dtLiveDeployDate` (없으면 `dtDeployDate`) — `현재시간 >= 해당날짜` 이어야 실행 허용
- `dtDeployDate`는 하위 호환용 (QA 또는 LIVE 날짜 중 대표값)

## 인메모리 데이터 위치

`backend/src/data/` — 게임 실행 DB와 별개 메타는 `DATA_STORE=mysql`이면 정규화 테이블(`mysqlAppSchema.ts`). **json 모드**일 때만 사용자별 UI 파일 `backend/data/userUiPreferences.json`. `STR_DATA_DIR` 규칙은 `jsonStore`와 동일(`DATA_DIR` 없으면 `__dirname` 기준 `backend/data`).
스키마는 `docs/schema.sql` · 정규화는 `docs/schema_normalized.sql` · 코드/JSON과의 차이는 `docs/SCHEMA-DATA-REVIEW.md` 참조.
- **JSON ↔ 메모리**: 기동 시 `fnLoadJson` 1회 로드, 변경 시 `fnSaveJson`. 사용자는 로그인 시 `fnReloadUsersFromFile`로 파일 재동기 가능.
- **활동 로그**: `ACTIVITY_LOG_ENABLED=1|true|on|yes`일 때만 `fnPushActivityLog`(메모리·SSE). json이면 `activity_logs.json` 배치 flush; **mysql**이면 `activity_log` + 스냅샷 플러시. Jest는 기록 강제 ON·push마다 즉시 저장.
- **목록 GET 보정**: 메모리가 비어 있고 디스크 `data/*.json`에 1건 이상이면 해당 목록 API에서 `fnReadJsonArrayFromDisk`로 재채움 — `events`(마이그레이션 `fnMigrateToQuerySets` 포함), `products`, `dbConnections`, `eventInstances`.
- **mysql 모드 JSON 미러**: `fnSaveEvents`/`fnSaveEventInstances`가 `events.json`·`eventInstances.json` 디스크 미러 즉시 기록(재기동·`import-json-to-mysql`용). 인스턴스 MySQL은 `event_instance*`만 치환(debounce·API는 `fnCommitEventInstancesToStore`로 응답 전 대기). 미러만 앞선 경우 기동 `fnReconcileMetaJsonWithMysql`(roles·user_roles FK 검증 포함)로 복구.
- **프로덕트 서비스**: `products.json`의 `IProduct.arrServices` — UI **서비스 구분**(약자 `strAbbr` + 리전 `strRegion`). 과거 `productServices.json` 분리 모듈은 제거됨.
