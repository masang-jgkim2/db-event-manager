# 스키마 vs 현재 데이터 구조 검토 (DB화 대비)

현재 인메모리(JSON) 및 TypeScript 타입과 `docs/schema.sql` / 정규화 스키마를 비교한 결과입니다. DB 전환 시 스키마 수정 또는 데이터 매핑 시 참고용입니다.

---

## 1. roles

| schema.sql (snake)     | 코드/JSON (camel) | 비고 |
|------------------------|-------------------|------|
| n_id                   | nId               | 일치 |
| str_code               | strCode           | 일치 |
| str_display_name       | strDisplayName    | 일치 |
| str_description        | strDescription    | 일치 |
| arr_permissions (JSON) | **별도 파일** rolePermissions.json | 코드는 정규화됨. DB화 시 `role_permissions(n_role_id, str_permission)` 테이블 권장 (schema_normalized.sql 참고). |
| b_is_system            | bIsSystem         | 일치 |
| dt_created_at          | dtCreatedAt       | 일치 |
| dt_updated_at          | dtUpdatedAt       | 일치 |

- **저장소**: `backend/data/roles.json` + `backend/data/rolePermissions.json`

---

## 2. users

| schema.sql (snake) | 코드/JSON (camel) | 비고 |
|--------------------|-------------------|------|
| n_id               | nId               | 일치 |
| str_user_id        | strUserId         | 일치 |
| str_password       | strPassword       | 일치 |
| str_display_name   | strDisplayName    | 일치 |
| arr_roles (JSON)   | **별도 파일** userRoles.json | 코드는 정규화됨. DB화 시 `user_roles(n_user_id, n_role_id)` 테이블 권장. |
| dt_created_at      | dtCreatedAt       | 일치 |

- **저장소**: `backend/data/users.json` + `backend/data/userRoles.json`

---

## 3. products

| schema.sql (snake) | 코드/JSON (camel) | 비고 |
|--------------------|-------------------|------|
| n_id               | nId               | 일치 |
| str_name           | strName           | 일치 |
| str_description    | strDescription    | 일치 |
| str_db_type        | strDbType         | 일치 |
| arr_services (JSON)| arrServices       | IService[] `[{strAbbr, strRegion}]` — 일치 |
| dt_created_at      | dtCreatedAt       | 일치 |

- **저장소**: `backend/data/products.json`
- **스키마와 일치**: 예 (JSON 컬럼명만 snake로 저장 시 일치)

---

## 4. event_templates (events)

| schema.sql (snake)   | 코드/JSON (camel) | 비고 |
|----------------------|-------------------|------|
| n_id                 | nId               | 일치 |
| n_product_id         | nProductId        | 일치 |
| str_product_name     | strProductName    | 일치 |
| str_event_label      | strEventLabel     | 일치 |
| str_category         | strCategory       | 일치 |
| str_type             | strType           | 일치 |
| str_input_format     | strInputFormat    | 일치 |
| str_description      | strDescription    | 일치 |
| str_default_items    | strDefaultItems   | 일치 |
| str_query_template   | strQueryTemplate  | 일치 (레거시 단일 쿼리) |
| dt_created_at        | dtCreatedAt       | 일치 |
| **(없음)**           | **arrQueryTemplates** | ⚠️ **스키마에 없음**. 다중 세트 시 사용. `IQueryTemplateItem[]` (nDbConnectionId, strDefaultItems?, strQueryTemplate). |

- **저장소**: `backend/data/events.json`
- **조치**: DB 스키마에 `arr_query_templates` JSON 컬럼 추가 필요 (또는 별도 테이블 `event_template_query_sets(n_template_id, n_index, n_db_connection_id, str_default_items, str_query_template)`).

---

## 5. db_connections

| schema.sql (snake) | 코드/JSON (camel) | 비고 |
|--------------------|-------------------|------|
| n_id               | nId               | 일치 |
| n_product_id       | nProductId        | 일치 |
| str_product_name   | strProductName    | 일치 |
| str_env            | strEnv            | 일치 |
| str_db_type        | strDbType         | 일치 |
| str_host           | strHost           | 일치 |
| n_port             | nPort             | 일치 |
| str_database       | strDatabase       | 일치 |
| str_user           | strUser           | 일치 |
| str_password       | strPassword       | 일치 |
| b_is_active        | bIsActive         | 일치 |
| dt_created_at      | dtCreatedAt       | 일치 |
| dt_updated_at      | dtUpdatedAt       | 일치 |
| **(없음)**         | **strKind**       | ⚠️ **스키마에 없음**. `GAME` \| `WEB` \| `LOG`. 다중 세트 실행 시 “동일 종류” 접속 선택에 사용. |
| UNIQUE(n_product_id, str_env) | — | ⚠️ 코드는 **프로덕트·환경당 여러 건** 허용(strKind별). 스키마는 1건만 허용. |

- **저장소**: `backend/data/dbConnections.json`
- **조치**:
  1. `str_kind` 컬럼 추가 (VARCHAR(20), 기본 'GAME').
  2. UNIQUE 제약을 `(n_product_id, str_env, str_kind)`로 변경하거나, 제거 후 (n_product_id, str_env, str_kind) UNIQUE로 관리.

---

## 6. event_instances

| schema.sql (snake)   | 코드/JSON (camel) | 비고 |
|----------------------|-------------------|------|
| n_id                 | nId               | 일치 |
| n_event_template_id  | nEventTemplateId  | 일치 |
| n_product_id         | nProductId        | 일치 |
| str_event_label      | strEventLabel     | 일치 |
| str_product_name     | strProductName    | 일치 |
| str_service_abbr     | strServiceAbbr    | 일치 |
| str_service_region   | strServiceRegion  | 일치 |
| str_category         | strCategory       | 일치 |
| str_type             | strType           | 일치 |
| str_event_name       | strEventName      | 일치 |
| str_input_values     | strInputValues    | 일치 |
| str_generated_query  | strGeneratedQuery | 일치 |
| dt_deploy_date       | dtDeployDate      | ISO 8601 문자열 — DB는 DATETIME으로 저장 시 변환 |
| arr_deploy_scope     | arrDeployScope    | JSON `['qa','live']` — 일치 |
| str_status           | strStatus         | 일치 |
| obj_creator … obj_live_verifier | objCreator … objLiveVerifier | JSON (IStageActor) — 일치 |
| arr_status_logs      | arrStatusLogs     | JSON IStatusLog[] — 일치 |
| str_created_by       | strCreatedBy      | 일치 |
| n_created_by_user_id | nCreatedByUserId  | 일치 |
| dt_created_at        | dtCreatedAt       | 일치 |
| **(없음)**           | **arrExecutionTargets** | ⚠️ **스키마에 없음**. `{ nDbConnectionId, strQuery }[]`. QA/LIVE 실행 시 사용. |

- **저장소**: `backend/data/eventInstances.json`
- **조치**: 스키마에 `arr_execution_targets` JSON 컬럼 추가 필요 (또는 별도 테이블로 분리).

---

## 7. 요약 — 스키마에 반영해야 할 항목

| 대상 | 추가/수정 내용 |
|------|----------------|
| **event_templates** | `arr_query_templates` JSON 컬럼 추가 (다중 쿼리 세트). |
| **db_connections** | `str_kind` 컬럼 추가; UNIQUE를 `(n_product_id, str_env, str_kind)`로 변경. |
| **event_instances** | `arr_execution_targets` JSON 컬럼 추가. |
| **roles / users** | schema.sql은 JSON 컬럼으로 정의돼 있음. 코드는 이미 role_permissions / user_roles 분리. DB화 시 정규화 스키마(schema_normalized.sql)의 role_permissions, user_roles 테이블 사용 권장. |

---

## 8. JSON/타입 ↔ 컬럼명 매핑 규칙

- 코드: **camelCase** (nId, strProductName, dtCreatedAt 등).
- 스키마: **snake_case** (n_id, str_product_name, dt_created_at).
- DB화 시 INSERT/SELECT 시 camel ↔ snake 변환 필요 (또는 DB 컬럼 alias/매핑 레이어에서 통일).

---

## 9. 참고 파일

- **스키마**: `docs/schema.sql` (MySQL 기준), `docs/schema_normalized.sql` (정규화·별도 테이블), `backend/src/db/migrations/V001__init_schema.sql` (MSSQL 마이그레이션).
- **타입**: `backend/src/data/*.ts`, `backend/src/types/index.ts`, `front/src/types/index.ts`.
- **데이터**: `backend/data/*.json` (실제 저장 파일).
