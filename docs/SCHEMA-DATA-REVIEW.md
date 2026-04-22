# 스키마 vs 현재 데이터 구조 검토 (DB화 대비)

현재 인메모리(JSON) 및 TypeScript 타입과 `docs/schema.sql` / `docs/schema_normalized.sql`를 비교한 결과입니다. **도메인 JSON·타입과 `docs/schema.sql`은 동기화됨** (인스턴스 QA/LIVE 일자·알로·영구 삭제·실행 타깃·템플릿 다중 세트·접속 `strKind` 반영).

---

## 1. roles

| schema.sql (snake)     | 코드/JSON (camel) | 비고 |
|------------------------|-------------------|------|
| n_id                   | nId               | 일치 |
| str_code               | strCode           | 일치 |
| str_display_name       | strDisplayName    | 일치 |
| str_description        | strDescription    | 일치 |
| arr_permissions (JSON) | **별도 파일** rolePermissions.json | 코드는 정규화됨. DB화 시 `role_permissions(n_role_id, str_permission)` 테이블 권장 (`schema_normalized.sql`). |
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
| str_query_template   | strQueryTemplate  | 레거시 단일 쿼리 |
| arr_query_templates  | arrQueryTemplates | `docs/schema.sql`에 JSON 컬럼 반영. 정규화 시 `event_template_query_sets` (`schema_normalized.sql`). |
| dt_created_at        | dtCreatedAt       | 일치 |

- **저장소**: `backend/data/events.json`

---

## 5. db_connections

| schema.sql (snake) | 코드/JSON (camel) | 비고 |
|--------------------|-------------------|------|
| n_id               | nId               | 일치 |
| n_product_id       | nProductId        | 일치 |
| str_product_name   | strProductName    | 일치 |
| str_kind           | strKind           | `GAME` \| `WEB` \| `LOG` — `docs/schema.sql` 반영 |
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
| UNIQUE(n_product_id, str_env, str_kind) | — | 코드와 동일 |

- **저장소**: `backend/data/dbConnections.json`
- **MSSQL 부분 스키마**: `docs/schema_mssql.sql`, `backend/src/db/migrations/V001__init_schema.sql`의 `db_connections`에도 `str_kind` + 동일 UNIQUE 반영 (신규 설치 기준).

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
| arr_execution_targets | arrExecutionTargets | JSON `IExecutionTarget[]` — `docs/schema.sql` 반영. 정규화 시 `instance_execution_targets` (`schema_normalized.sql`). |
| dt_deploy_date       | dtDeployDate      | 레거시/호환 |
| dt_qa_deploy_date    | dtQaDeployDate    | nullable |
| dt_live_deploy_date  | dtLiveDeployDate  | nullable |
| str_allo_link        | strAlloLink       | nullable |
| arr_deploy_scope     | arrDeployScope    | JSON |
| str_status           | strStatus         | 일치 |
| obj_creator … obj_live_verifier | objCreator … objLiveVerifier | JSON (`IStageActor`) |
| arr_status_logs      | arrStatusLogs     | JSON `IStatusLog[]` |
| str_created_by       | strCreatedBy      | 일치 |
| n_created_by_user_id | nCreatedByUserId  | 일치 |
| dt_created_at        | dtCreatedAt       | 일치 |
| b_permanently_removed | bPermanentlyRemoved | 일치 |
| dt_permanently_removed_at | dtPermanentlyRemovedAt | 일치 |

- **저장소**: `backend/data/eventInstances.json`
- **정규화 스키마**: `schema_normalized.sql`은 처리자·로그를 별도 테이블로 쪼개는 설계이며, 위 컬럼은 `event_instances` + `instance_execution_targets` 등으로 매핑.

---

## 7. 요약 — 스키마 문서 반영 상태

| 대상 | 상태 |
|------|------|
| **event_templates** | `arr_query_templates` — `docs/schema.sql` 반영. 정규화: `event_template_query_sets` + (선택) JSON 컬럼 |
| **db_connections** | `str_kind`, UNIQUE `(n_product_id, str_env, str_kind)` — 반영 |
| **event_instances** | `arr_execution_targets`, QA/LIVE 일자, `str_allo_link`, 영구 삭제 플래그/시각 — 반영 |
| **roles / users** | `schema.sql`은 JSON 컬럼 예시 유지. 런타임은 `rolePermissions.json` / `userRoles.json` — DB화 시 `schema_normalized.sql` 권장 |

---

## 8. JSON/타입 ↔ 컬럼명 매핑 규칙

- 코드: **camelCase** (nId, strProductName, dtCreatedAt 등).
- 스키마: **snake_case** (n_id, str_product_name, dt_created_at).
- DB화 시 INSERT/SELECT 시 camel ↔ snake 변환 필요 (또는 매핑 레이어에서 통일).

---

## 9. 참고 파일

- **스키마**: `docs/schema.sql`, `docs/schema_normalized.sql`, `docs/schema_mssql.sql`, `backend/src/db/migrations/V001__init_schema.sql`
- **타입**: `backend/src/data/*.ts`, `backend/src/types/index.ts`, `front/src/types/index.ts`
- **데이터**: `backend/data/*.json` (실제 저장 파일)

---

## 10. 스키마 SQL에 없는 보조 저장소 (기능용)

앱 기능에 쓰이지만 **도메인 엔티티 테이블 목록에는 포함하지 않음** (별도 설계).

| 파일 | 용도 |
|------|------|
| `activity_logs.json` | HTTP 요청 활동 로그 (`IActivityLogRow`). `schema_normalized.sql`의 `audit_logs`와 목적이 다름(감사 vs 요청 로그). |
| `userUiPreferences.json` | 사용자 UI 설정(`mapByUserId`). 전용 key-value/설정 테이블로 DB화 시 분리. |

---

## 11. 인메모리 전용 (JSON 아님)

- **템플릿 실행 경과 시간** 등 일시 상태, **SSE 구독자·presence** 등은 파일/위 스키마 범위 밖.
