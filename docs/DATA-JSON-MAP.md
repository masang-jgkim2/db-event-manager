# 백엔드 데이터 JSON ↔ 모듈 ↔ 기능

`DATA_DIR` 미설정 시 실제 경로는 [jsonStore.ts](../backend/src/data/jsonStore.ts) 기준 `backend/data/` (빌드 후에는 `dist` 옆 `data`와 동일 규칙).

**`DATA_STORE=mysql`**: 런타임은 인메모리 배열 동일, 영속은 MySQL 정규화 메타 테이블([DATA-BACKEND-MYSQL.md](./DATA-BACKEND-MYSQL.md)). 기동 시 `product`가 비어 있으면 JSON에서 자동 적재(옵트아웃 `DATA_MYSQL_NO_JSON_IMPORT`). DDL은 [dqpm_meta_relational_schema.sql](./dqpm_meta_relational_schema.sql) = [mysqlAppSchema.ts](../backend/src/db/mysqlAppSchema.ts).

## 1. JSON 파일 · 데이터 모듈 · 주요 기능

| JSON (클릭) | 데이터 모듈 | 주요 기능 |
|---------------|-------------|-----------|
| [products.json](../backend/data/products.json) | [products.ts](../backend/src/data/products.ts) | 제품·서비스(`arrServices`), DB접속/템플릿/인스턴스의 `nProductId` |
| [events.json](../backend/data/events.json) | [events.ts](../backend/src/data/events.ts) | 쿼리 템플릿 CRUD, 인스턴스의 `nEventTemplateId` |
| [eventInstances.json](../backend/data/eventInstances.json) | [eventInstances.ts](../backend/src/data/eventInstances.ts) | 인스턴스·대시보드·쿼리 실행·SSE |
| [dbConnections.json](../backend/data/dbConnections.json) | [dbConnections.ts](../backend/src/data/dbConnections.ts) | DB 접속 정보, 실행 시 접속 선택 |
| [users.json](../backend/data/users.json) | [users.ts](../backend/src/data/users.ts) | 로그인, 사용자 CRUD, 비밀번호 해시 |
| [userRoles.json](../backend/data/userRoles.json) | [userRoles.ts](../backend/src/data/userRoles.ts) | 사용자–역할 매핑 (`nUserId` ↔ `nRoleId`) |
| [roles.json](../backend/data/roles.json) | [roles.ts](../backend/src/data/roles.ts) | 역할 메타(코드·표시명). **권한 문자열은 이 파일에 없음** |
| [rolePermissions.json](../backend/data/rolePermissions.json) | [rolePermissions.ts](../backend/src/data/rolePermissions.ts) | 역할별 권한 코드(RBAC 조립) |
| [activity_logs.json](../backend/data/activity_logs.json) | [activityLogs.ts](../backend/src/data/activityLogs.ts) | 활동 로그 조회·삭제·SSE `activity_log_appended` |
| [userUiPreferences.json](../backend/data/userUiPreferences.json) | [userUiPreferences.ts](../backend/src/data/userUiPreferences.ts) | 사용자별 UI 설정 루트 객체 `mapByUserId` (배열 JSON이 아님) |

공통 저장 유틸: [jsonStore.ts](../backend/src/data/jsonStore.ts) (`fnLoadJson` / `fnSaveJson` / `fnReadJsonArrayFromDisk`).

---

## 2. JSON이 없는 데이터 (중복 파일 없음)

| 위치 | 용도 | 비고 |
|------|------|------|
| [templateExecElapsed.ts](../backend/src/data/templateExecElapsed.ts) | 템플릿+환경별 마지막 성공 실행 ms | `Map` 인메모리만, 재시작 시 초기화 |
| [userPresence.ts](../backend/src/services/userPresence.ts) | 온라인 근사·마지막 활동 | `Map` 인메모리, 재시작 시 초기화 |

---

## 3. “나뉘어 보이는” 것 — **중복 저장이 아니라 정규화**

| 관계 | 설명 |
|------|------|
| `users.json` + `userRoles.json` | 사용자 행과 역할 매핑 분리. API는 조립해 `arrRoles` 반환. |
| `roles.json` + `rolePermissions.json` | 역할 정의와 권한 목록 분리. `roles.ts`가 `rolePermissions`와 조립해 API용 `IRole` 생성. |

과거에 제거된 별도 서비스 JSON은 없음. 제품 서비스는 **`products.json`의 `arrServices`만** 단일 소스.

---

## 4. 시드·스냅샷 정리

### 4.1 테스트 스냅샷 `seed_test.json`

| 항목 | 내용 |
|------|------|
| 파일 | [seed_test.json](../backend/data/seed_test.json) (없을 수 있음) |
| 코드 | [seedTest.ts](../backend/src/data/seedTest.ts), 부팅: [index.ts](../backend/src/index.ts) |
| 동작 | 파일이 **있으면** 서버 기동 시 메모리에 **아래 6개만** 덮어씀: `products`, `events`, `users`, `roles`, `dbConnections`, `eventInstances` |
| **포함 안 됨** | `userRoles`, `rolePermissions`, `activity_logs`, `userUiPreferences` → 항상 **각자 JSON**에서만 로드 |
| 주의 | 시드의 `users` 등과 디스크 `userRoles.json`의 `nUserId`가 어긋나면 권한이 깨질 수 있음. 시드 사용 시 **역할 매핑까지** 맞출 것. |

### 4.2 `fnLoadJson` — 파일 없을 때만 쓰는 **모듈 내 시드**

파일이 없으면 시드 배열을 메모리에 쓰고, 일부는 곧바로 파일 생성([jsonStore.ts](../backend/src/data/jsonStore.ts) 참고).

| 모듈 | 시드 상수 | 비고 |
|------|-----------|------|
| [users.ts](../backend/src/data/users.ts) | `ARR_SEED` | 비밀번호 `__PENDING__` → [fnInitUsers](../backend/src/data/users.ts)에서 해시 후 저장 |
| [userRoles.ts](../backend/src/data/userRoles.ts) | `ARR_SEED` | 배열이 비면 시드로 복구 후 저장 |
| [roles.ts](../backend/src/data/roles.ts) | `ARR_SEED_ROWS` | |
| [products.ts](../backend/src/data/products.ts) | `ARR_SEED` | |
| [rolePermissions.ts](../backend/src/data/rolePermissions.ts) | `ARR_SEED` | |
| [events.ts](../backend/src/data/events.ts) / [eventInstances.ts](../backend/src/data/eventInstances.ts) / [dbConnections.ts](../backend/src/data/dbConnections.ts) | `[]` | 빈 배열 시드 |

### 4.3 부팅 시 **파일을 고쳐 쓰는** 보정 (코드 시드와 파일 내용 차이 가능)

| 위치 | 내용 |
|------|------|
| [rolePermissions.ts](../backend/src/data/rolePermissions.ts) | DBA 필수 권한·admin `activity.view` / `activity.clear` 없으면 추가 후 저장 |
| [events.ts](../backend/src/data/events.ts) | 스키마 마이그레이션 필요 시 마이그레이션 결과를 `events.json`에 저장 |

---

## 5. 이중 진실·유령 중복에 가까운 것

| 구분 | 설명 |
|------|------|
| `seed_test.json` vs 개별 6개 JSON | `seed_test.json`이 있으면 **부팅 시 메모리는 시드 우선**. 디스크의 해당 6개 파일과 **내용이 달라질 수 있음**(저장 API는 여전히 개별 JSON에 기록). |
| [ProductRepository.ts](../backend/src/repositories/ProductRepository.ts) | `arrProducts` 래퍼이나 **현재 다른 파일에서 import되지 않음**. 데이터 이중화는 아니고 미사용 레이어에 가까움. |
| [userUiPreferences.ts](../backend/src/data/userUiPreferences.ts) | 요청마다 파일 읽기/쓰기 — 다른 엔티티의 “기동 시 한 번 로드한 배열” 패턴과 다름. **파일 하나**만 쓰므로 JSON 이중화는 아님. |

---

## 6. 부팅 로그 프로브 `ARR_PROBE_FILES`

[jsonStore.ts](../backend/src/data/jsonStore.ts)에 `exists/size` 로그용으로 나열된 파일:  
`products`, `events`, `dbConnections`, `eventInstances`, `users`, `roles`, `rolePermissions`.  
**없음**: `userRoles`, `activity_logs`, `userUiPreferences` (동작과 무관, 로그만 덜 찍힘).
