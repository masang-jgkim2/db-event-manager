# schema.sql / schema_mssql.sql vs 현재 코드 검토

> 스키마 정의와 인메모리(코드) 구조 비교 및 불일치 정리 (2026-03-10)

---

## 1. 대상 파일

| 파일 | 대상 DB | 용도 |
|------|---------|------|
| `docs/schema.sql` | MySQL 8.0+ | roles, users, products, event_templates, db_connections, event_instances 전체 |
| `docs/schema_mssql.sql` | MSSQL 2019+ | roles, users, db_connections 만 (products/event_templates/event_instances 없음) |
| 코드 | 인메모리 (JSON) | `backend/src/data/*.ts`, `backend/src/types/index.ts` |

---

## 2. 테이블·인터페이스 매핑 요약

| 스키마 테이블 (schema.sql) | 코드 (데이터/타입) | 비고 |
|----------------------------|---------------------|------|
| roles | `data/roles.ts` (arrRoles), `types` IRole | 일치 |
| users | `data/users.ts` (arrUsers), `types` IUser | 일치 (타입만 IUser.dtCreatedAt은 Date) |
| products | `data/products.ts` (arrProducts), IProduct | 일치 |
| event_templates | `data/events.ts` (arrEvents), IEventTemplate | 일치 |
| db_connections | `data/dbConnections.ts` (arrDbConnections), IDbConnection | 일치 |
| event_instances | `data/eventInstances.ts` (arrEventInstances), IEventInstance | **불일치 있음** (아래 상세) |

---

## 3. 테이블별 상세 비교

### 3.1 roles

| schema.sql 컬럼 | 코드 (IRole / roles.ts) | 비고 |
|-----------------|--------------------------|------|
| n_id | nId | ✓ |
| str_code | strCode | ✓ |
| str_display_name | strDisplayName | ✓ |
| str_description | strDescription | ✓ |
| arr_permissions (JSON) | arrPermissions | ✓ |
| b_is_system | bIsSystem | ✓ |
| dt_created_at | dtCreatedAt | ✓ |
| dt_updated_at | dtUpdatedAt | ✓ |

→ **일치.**

---

### 3.2 users

| schema.sql 컬럼 | 코드 (IUser / users.ts) | 비고 |
|-----------------|--------------------------|------|
| n_id | nId | ✓ |
| str_user_id | strUserId | ✓ |
| str_password | strPassword | ✓ |
| str_display_name | strDisplayName | ✓ |
| arr_roles (JSON) | arrRoles | ✓ |
| dt_created_at | dtCreatedAt | ✓ (타입은 Date, JSON 저장 시 ISO 문자열) |

→ **일치.**

---

### 3.3 products

| schema.sql 컬럼 | 코드 (IProduct / products.ts) | 비고 |
|-----------------|-------------------------------|------|
| n_id | nId | ✓ |
| str_name | strName | ✓ |
| str_description | strDescription | ✓ |
| str_db_type | strDbType | ✓ |
| arr_services (JSON) | arrServices (IService[]) | ✓ |
| dt_created_at | dtCreatedAt | ✓ |

→ **일치.**

---

### 3.4 event_templates

| schema.sql 컬럼 | 코드 (IEventTemplate / events.ts) | 비고 |
|-----------------|-----------------------------------|------|
| n_id | nId | ✓ |
| n_product_id | nProductId | ✓ |
| str_product_name | strProductName | ✓ |
| str_event_label | strEventLabel | ✓ |
| str_category | strCategory | ✓ |
| str_type | strType | ✓ |
| str_input_format | strInputFormat | ✓ |
| str_description | strDescription | ✓ |
| str_default_items | strDefaultItems | ✓ |
| str_query_template | strQueryTemplate | ✓ |
| dt_created_at | dtCreatedAt | ✓ |

→ **일치.**

---

### 3.5 db_connections

| schema.sql 컬럼 | 코드 (IDbConnection / dbConnections.ts) | 비고 |
|-----------------|----------------------------------------|------|
| n_id | nId | ✓ |
| n_product_id | nProductId | ✓ |
| str_product_name | strProductName | ✓ |
| str_env | strEnv | ✓ |
| str_db_type | strDbType | ✓ |
| str_host | strHost | ✓ |
| n_port | nPort | ✓ |
| str_database | strDatabase | ✓ |
| str_user | strUser | ✓ |
| str_password | strPassword | ✓ |
| b_is_active | bIsActive | ✓ |
| dt_created_at | dtCreatedAt | ✓ |
| dt_updated_at | dtUpdatedAt | ✓ |

→ **일치.**

---

### 3.6 event_instances — 불일치 있음

| schema.sql 컬럼 | 코드 (IEventInstance / eventInstances.ts) | 비고 |
|-----------------|-------------------------------------------|------|
| n_id | nId | ✓ |
| n_event_template_id | nEventTemplateId | ✓ |
| str_event_label | strEventLabel | ✓ |
| str_product_name | strProductName | ✓ |
| str_service_abbr | strServiceAbbr | ✓ |
| str_service_region | strServiceRegion | ✓ |
| str_category | strCategory | ✓ |
| str_type | strType | ✓ |
| str_event_name | strEventName | ✓ |
| str_input_values | strInputValues | ✓ |
| str_generated_query | strGeneratedQuery | ✓ |
| **dt_exec_date** | **dtDeployDate** | ⚠️ **이름·타입 불일치** |
| str_status | strStatus | ✓ |
| obj_creator ~ obj_live_deployer | objCreator ~ objLiveDeployer | ✓ (JSON) |
| arr_status_logs | arrStatusLogs | ✓ (JSON) |
| str_created_by | strCreatedBy | ✓ |
| n_created_by_user_id | nCreatedByUserId | ✓ |
| dt_created_at | dtCreatedAt | ✓ |
| **n_product_id** | **nProductId** | ❌ **스키마에 없음** |
| **arr_deploy_scope** | **arrDeployScope** | ❌ **스키마에 없음** |

#### 불일치 상세

1. **n_product_id 없음 (스키마)**  
   - 코드: `IEventInstance.nProductId` 사용. `fnFindActiveConnection(nProductId, strEnv)`로 DB 접속 정보 조회.  
   - 스키마에 컬럼이 없으면 DB 전환 시 인스턴스별로 “어느 프로덕트 DB로 실행할지”를 조회할 수 없음 (str_product_name만으로는 FK/인덱스 활용 불가).  
   - **권장**: `event_instances`에 `n_product_id INT NOT NULL`, `FOREIGN KEY (n_product_id) REFERENCES products(n_id)`, `INDEX idx_product_id (n_product_id)` 추가.

2. **arr_deploy_scope 없음 (스키마)**  
   - 코드: `arrDeployScope: Array<'qa' | 'live'>` (기본 `['qa','live']`, LIVE만 반영 시 `['live']`). QA 단계 스킵 등 워크플로에서 사용.  
   - **권장**: `event_instances`에 `arr_deploy_scope JSON NOT NULL DEFAULT '["qa","live"]'` 추가.

3. **dt_exec_date vs dtDeployDate**  
   - 스키마: `dt_exec_date VARCHAR(20) COMMENT 'YYYY-MM-DD'` → 날짜만.  
   - 코드: `dtDeployDate: string` (ISO 8601 **datetime** 예: `2026-03-10T12:00:00.000Z`). LIVE 반영 시 “현재 시각 >= 반영 날짜” 비교에 시분초까지 사용.  
   - **권장**:  
     - 컬럼명을 `dt_deploy_date`로 통일하고,  
     - 타입을 `DATETIME`(MySQL) / `DATETIME2`(MSSQL)로 저장해 코드와 동일하게 “날짜+시간”으로 다루는 것이 안전함.  
     - 또는 VARCHAR(30)으로 ISO 8601 전체 저장해도 동작은 가능 (비교 시 파싱 필요).

---

## 4. schema_mssql.sql 정리

- **포함 테이블**: `roles`, `users`, `db_connections` 만 존재.
- **없는 테이블**: `products`, `event_templates`, `event_instances`.
- **용도**: 주석상 “db_manager 데이터베이스”용으로, 사용자/역할/DB접속 정보만 관리하는 부분 스키마로 보임.  
- **전체 앱을 MSSQL로 이전할 경우**: `products`, `event_templates`, `event_instances`에 해당하는 MSSQL 테이블 정의가 추가로 필요함.

---

## 5. JSON 컬럼 구조 (코드와 동일해야 할 값)

스키마의 JSON 컬럼이 코드와 호환되려면 아래 구조와 맞아야 함.

- **arr_services (products)**  
  `[{ "strAbbr": "AO/KR", "strRegion": "국내" }, ...]`

- **arr_permissions (roles)**  
  `["product.view", "product.manage", ...]` (TPermission[])

- **arr_roles (users)**  
  `["admin", "dba"]` (역할 코드 배열)

- **obj_creator ~ obj_live_deployer (event_instances)**  
  `{ "strDisplayName": "...", "nUserId": 1, "strUserId": "admin", "dtProcessedAt": "2026-03-10T12:00:00.000Z" }` 또는 null

- **arr_status_logs (event_instances)**  
  `[{ "strStatus": "qa_deployed", "strChangedBy": "...", "nChangedByUserId": 1, "strComment": "...", "dtChangedAt": "...", "objExecutionResult?": { "strEnv": "qa", "nTotalAffectedRows": 3, "nElapsedMs": 100, "arrQueryResults": [...] } }, ...]`

- **arr_deploy_scope (event_instances, 스키마 반영 시)**  
  `["qa", "live"]` 또는 `["live"]`

---

## 6. 수정 반영 (schema.sql) — 적용 완료

다음이 **schema.sql**에 반영됨.

1. **event_instances**
   - `n_product_id INT NOT NULL` 추가, `FOREIGN KEY (n_product_id) REFERENCES products(n_id)`, `INDEX idx_product_id (n_product_id)`.
   - `arr_deploy_scope JSON NOT NULL DEFAULT ('["qa", "live"]')` 추가.
   - `dt_exec_date` → `dt_deploy_date DATETIME NOT NULL` (또는 `VARCHAR(30)`으로 ISO 8601 전체 저장)으로 변경하고, 필요 시 COMMENT에 “반영 일시 (ISO 8601 또는 DATETIME)” 명시.

2. **schema_mssql.sql**
   - 전체 앱 이전 시 `products`, `event_templates`, `event_instances` 테이블을 MySQL 스키마에 맞춰 추가 필요.

---

## 7. 요약

| 항목 | 상태 |
|------|------|
| roles, users, products, event_templates, db_connections | 스키마·코드 **일치** |
| event_instances (schema.sql) | **반영 완료**: n_product_id, arr_deploy_scope 추가, dt_deploy_date 로 통일 |
| schema_mssql.sql | roles/users/db_connections만 있음; products, event_templates, event_instances **없음** |
