# JSON 컬럼 정규화 제안

> 로그/감사 조회를 위해 JSON 컬럼을 별도 테이블로 분리하는 방안 (2026-03-10)

**적용 범위**: 정규화된 최종 스키마(`schema_normalized.sql`)와 본 제안은 **현재 인메모리 구조**(`backend/src/data/*.ts`), **백엔드/프론트 타입**(`IProduct`, `IUser`, `IRole`, `IEventInstance`, `IStatusLog`, `IStageActor` 등), **Controller에서의 참조·저장 방식**, 그리고 **테이블 간 관계**(FK, 1:N)를 모두 고려해 설계됨. 섹션 7에서 코드·인메모리와 정규화 스키마의 매핑과 조립 방법을 정리함.

---

## 1. 현재 JSON 컬럼 정리

| 테이블 | JSON 컬럼 | 내용 | 로그/조회 시 이슈 |
|--------|-----------|------|-------------------|
| roles | arr_permissions | 권한 코드 배열 | "이 권한 가진 역할 목록" 조회 시 JSON 함수 필요 |
| users | arr_roles | 역할 코드 배열 | "이 역할인 사용자" 조회, 역할 변경 이력 추적 어려움 |
| products | arr_services | [{strAbbr, strRegion}] | "이 서비스인 프로덕트" 조회 시 JSON 검색 |
| event_instances | arr_deploy_scope | ['qa','live'] 등 | 반영 범위별 필터 시 JSON |
| event_instances | obj_creator ~ obj_live_verifier | 처리자 1명씩 (IStageActor) | "이 사용자가 처리한 인스턴스" 조회 시 8개 컬럼 검색 |
| event_instances | arr_status_logs | 상태 변경 이력 배열 | **이벤트 로그** 조회 시 JSON 풀어서 검색/인덱스 불가 |

이 중 **arr_status_logs**는 이벤트 로그 화면의 핵심 데이터이므로 정규화 시 효과가 가장 크고, **users.arr_roles** / **event_instances 처리자**는 사용자별 행위 로그와 직결됩니다.

---

## 2. 정규화 제안 요약

| 기존 JSON | 정규화 테이블 | 비고 |
|-----------|----------------|------|
| roles.arr_permissions | **role_permissions** (n_role_id, str_permission) | 역할별 권한 로그/조회 |
| users.arr_roles | **user_roles** (n_user_id, n_role_id) | 사용자별 역할 로그/조회 |
| products.arr_services | **product_services** (n_product_id, str_abbr, str_region) | 프로덕트별 서비스 로그/조회 |
| event_instances.arr_deploy_scope | **instance_deploy_scopes** (n_instance_id, str_env) | 반영 범위 필터 |
| event_instances.obj_* (처리자 8개) | **event_instances**에 n_*_user_id 컬럼 8개 (FK users) | 처리자 = users 조인, "누가 처리" 조회 단순 |
| event_instances.arr_status_logs | **instance_status_logs** + (선택) **instance_execution_results** | **이벤트 로그** 전용 테이블, 인덱스로 기간/사용자/상태 조회 |

---

## 3. 정규화 스키마 상세

### 3.1 role_permissions (roles.arr_permissions 분리)

```sql
CREATE TABLE role_permissions (
  n_role_id     INT          NOT NULL,
  str_permission VARCHAR(80) NOT NULL,
  PRIMARY KEY (n_role_id, str_permission),
  FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE CASCADE
);
```

- 역할별 권한 추가/삭제 시 이 테이블만 변경하면 되어, 감사 로그(role_permissions 변경 이력) 수집이 명확해짐.

### 3.2 user_roles (users.arr_roles 분리)

```sql
CREATE TABLE user_roles (
  n_user_id   INT NOT NULL,
  n_role_id   INT NOT NULL,
  PRIMARY KEY (n_user_id, n_role_id),
  FOREIGN KEY (n_user_id) REFERENCES users(n_id) ON DELETE CASCADE,
  FOREIGN KEY (n_role_id) REFERENCES roles(n_id) ON DELETE RESTRICT
);
```

- "이 역할을 가진 사용자", "이 사용자의 역할 변경 이력" 조회/로그에 유리.

### 3.3 product_services (products.arr_services 분리)

```sql
CREATE TABLE product_services (
  n_id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_product_id  INT         NOT NULL,
  str_abbr      VARCHAR(50) NOT NULL,
  str_region    VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_product_abbr_region (n_product_id, str_abbr, str_region),
  FOREIGN KEY (n_product_id) REFERENCES products(n_id) ON DELETE CASCADE
);
```

### 3.4 instance_deploy_scopes (event_instances.arr_deploy_scope 분리)

```sql
CREATE TABLE instance_deploy_scopes (
  n_instance_id INT         NOT NULL,
  str_env       VARCHAR(10) NOT NULL COMMENT 'qa | live',
  PRIMARY KEY (n_instance_id, str_env),
  FOREIGN KEY (n_instance_id) REFERENCES event_instances(n_id) ON DELETE CASCADE
);
```

### 3.5 event_instances 처리자 (obj_* → FK 컬럼)

JSON 8개(obj_creator ~ obj_live_verifier) 제거 후, 컬럼으로 보강:

```sql
-- event_instances 테이블에 추가 (기존 obj_* 제거)
n_creator_user_id       INT NULL,
n_confirmer_user_id     INT NULL,
n_qa_requester_user_id  INT NULL,
n_qa_deployer_user_id   INT NULL,
n_qa_verifier_user_id   INT NULL,
n_live_requester_user_id INT NULL,
n_live_deployer_user_id INT NULL,
n_live_verifier_user_id INT NULL,
FOREIGN KEY (n_creator_user_id) REFERENCES users(n_id),
-- ... 나머지도 동일
```

- 표시 이름/처리 시각은 **instance_status_logs** 또는 기존 status_log 이력과 조합해 사용. (처리 시각은 상태 변경 시점과 동일하다고 가정)

### 3.6 instance_status_logs (event_instances.arr_status_logs 분리) — 핵심

```sql
CREATE TABLE instance_status_logs (
  n_id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_instance_id         INT           NOT NULL,
  str_status            VARCHAR(30)   NOT NULL,
  n_changed_by_user_id  INT           NOT NULL,
  str_comment           TEXT          NULL,
  dt_changed_at         DATETIME      NOT NULL,

  FOREIGN KEY (n_instance_id) REFERENCES event_instances(n_id) ON DELETE CASCADE,
  FOREIGN KEY (n_changed_by_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  INDEX idx_instance_id (n_instance_id),
  INDEX idx_changed_by (n_changed_by_user_id),
  INDEX idx_dt_changed (dt_changed_at),
  INDEX idx_status (str_status)
);
```

- **이벤트 로그** 화면: 이 테이블 기준으로 기간/사용자/상태/인스턴스 필터 + event_instances 조인으로 "이벤트명·프로덕트" 등 표시 가능.

### 3.7 instance_execution_results (실행 결과만 분리, 선택)

qa_deployed / live_deployed 시의 실행 결과를 별도 테이블로 두면 "실행 로그" 조회가 단순해짐.

```sql
CREATE TABLE instance_execution_results (
  n_id                    INT     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_status_log_id         INT     NOT NULL UNIQUE COMMENT 'instance_status_logs.n_id (qa_deployed/live_deployed 행)',
  str_env                 VARCHAR(10) NOT NULL COMMENT 'qa | live',
  n_total_affected_rows   INT     NOT NULL DEFAULT 0,
  n_elapsed_ms            INT     NOT NULL DEFAULT 0,
  str_executed_query      LONGTEXT NULL,
  FOREIGN KEY (n_status_log_id) REFERENCES instance_status_logs(n_id) ON DELETE CASCADE
);

-- 쿼리 단위 결과는 건수 많을 수 있으므로 JSON 유지 또는 별도 테이블
CREATE TABLE execution_query_parts (
  n_id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_result_id       INT NOT NULL,
  n_index           INT NOT NULL,
  str_query         LONGTEXT NULL,
  n_affected_rows   INT NOT NULL DEFAULT 0,
  FOREIGN KEY (n_result_id) REFERENCES instance_execution_results(n_id) ON DELETE CASCADE
);
```

- 실행 실패 로그도 남기려면 instance_status_logs에 "실패"용 행을 넣거나, **execution_results**에 b_success, str_error 컬럼을 두는 방식으로 확장 가능.

---

## 4. 로그/감사 관점 정리

| 목표 | 정규화 전 | 정규화 후 |
|------|-----------|-----------|
| 이벤트 로그 (기간/사용자/상태) | arr_status_logs JSON 풀어서 검색, 인덱스 불가 | instance_status_logs 테이블로 WHERE + 인덱스 |
| 사용자별 최근 행위 | 8개 obj_* + arr_status_logs 검색 | n_changed_by_user_id + instance_status_logs |
| 역할 변경 이력 | users.arr_roles 덮어쓰기만 가능 | user_roles INSERT/DELETE로 이력 테이블에 기록 가능 |
| "이 권한 가진 역할" 조회 | JSON_CONTAINS 등 | role_permissions 조인 |
| 실행 성공/실패 쿼리 로그 | 성공만 인스턴스 JSON 안에 | instance_status_logs + instance_execution_results로 통일 저장 가능 |

---

## 5. 적용 순서 제안

1. **1차 (로그 핵심)**: **instance_status_logs** 도입, event_instances.arr_status_logs는 레거시 호환용으로 유지하다가 단계적 이전 또는 뷰/트리거로 동기화.
2. **2차**: **user_roles**, **role_permissions** 도입 후 users/roles API가 이 테이블 기준으로 동작하도록 변경.
3. **3차**: **event_instances** 처리자 FK 컬럼 추가, obj_* 제거. **instance_deploy_scopes**, **product_services** 도입.
4. **4차 (선택)**: **instance_execution_results** / **execution_query_parts** 도입, 실행 로그 전용 조회.

---

## 6. 정규화 스키마 파일

- **docs/schema_normalized.sql**: 위 정규화를 반영한 전체 DDL (MySQL 기준).
  - roles/users/products/event_templates/db_connections/event_instances + role_permissions, user_roles, product_services, instance_deploy_scopes, instance_status_logs, instance_execution_results, execution_query_parts.
  - 시드: roles, role_permissions, users, user_roles (admin 계정 1개).

애플리케이션 전환 시: 기존 JSON을 읽고 쓰는 코드를 새 테이블 조회/INSERT·DELETE로 바꾸고, **instance_status_logs**는 상태 변경/실행 시마다 1건 INSERT하도록 수정해야 합니다.

---

## 7. 인메모리·코드와 정규화 스키마 매핑

정규화 스키마는 **현재 인메모리 구조(backend/src/data/*.ts) 및 타입(backend/src/types, front/src/types)** 과 1:1 대응되도록 설계됨. DB 전환 시 Repository/서비스 계층에서 아래 매핑으로 API 응답을 조립하면 기존 인터페이스를 그대로 유지할 수 있음.

### 7.1 엔티티 관계도 (코드 ↔ 정규화 스키마)

```
[코드: arrProducts / IProduct]
  products (1) ──* product_services     → arrServices: IService[]

[코드: arrEvents / IEventTemplate]
  event_templates (n_product_id → products)

[코드: arrUsers / IUser]
  users (1) ──* user_roles ──* roles   → arrRoles: string[] (roles.str_code 조인)

[코드: arrRoles / IRole]
  roles (1) ──* role_permissions        → arrPermissions: TPermission[]

[코드: arrDbConnections / IDbConnection]
  db_connections (n_product_id → products)

[코드: arrEventInstances / IEventInstance]
  event_instances (n_event_template_id, n_product_id, n_created_by_user_id, n_creator_user_id … 8개 처리자 FK)
    ├─ (1) * instance_deploy_scopes     → arrDeployScope: ('qa'|'live')[]
    ├─ (1) * instance_status_logs       → arrStatusLogs: IStatusLog[]
    │       └─ (0..1) instance_execution_results → IStatusLog.objExecutionResult
    │               └─ * execution_query_parts   → arrQueryResults[]
    └─ 처리자 8명: n_*_user_id → users 조인 → IStageActor (strDisplayName, strUserId, dtProcessedAt은 아래 참고)
```

### 7.2 인터페이스별 테이블·조립 방법

| 코드 인터페이스 | 인메모리 저장소 | 정규화 후 읽기 | 정규화 후 쓰기 |
|-----------------|-----------------|----------------|----------------|
| **IProduct** | products.ts | products 1행 + product_services N행 → arrServices 배열 | products INSERT/UPDATE + product_services DELETE/INSERT |
| **IService** | (IProduct.arrServices[]) | product_services.str_abbr, str_region | product_services INSERT |
| **IEventTemplate** | events.ts | event_templates 1행 (변경 없음) | event_templates CRUD |
| **IRole** | roles.ts | roles 1행 + role_permissions N행 → arrPermissions | roles CRUD + role_permissions DELETE/INSERT |
| **IUser** | users.ts | users 1행 + user_roles JOIN roles → arrRoles(str_code[]) | users CRUD + user_roles DELETE/INSERT |
| **IDbConnection** | dbConnections.ts | db_connections 1행 (변경 없음) | db_connections CRUD |
| **IEventInstance** | eventInstances.ts | event_instances 1행 + instance_deploy_scopes + instance_status_logs(+ execution_results) + 처리자 8명 users 조인 | 아래 7.3 참고 |
| **IStageActor** | (IEventInstance.objCreator 등) | users 조인 → strDisplayName=str_display_name, strUserId=str_user_id, nUserId=n_id. **dtProcessedAt**: 해당 단계 상태의 instance_status_logs.dt_changed_at (예: objConfirmer → str_status='dba_confirmed'인 로그 1건의 dt_changed_at) | event_instances.n_*_user_id UPDATE, 해당 상태 전이 시 instance_status_logs INSERT |
| **IStatusLog** | (IEventInstance.arrStatusLogs[]) | instance_status_logs 1행 + users(처리자) + instance_execution_results(있으면) → strChangedBy, objExecutionResult 등 | 상태 변경/실행 시 instance_status_logs INSERT, 실행 시 instance_execution_results + execution_query_parts INSERT |

### 7.3 IEventInstance 조립 (정규화 DB → API 응답)

1. **event_instances** 1행 읽기.
2. **instance_deploy_scopes** WHERE n_instance_id → arrDeployScope 배열 (str_env).
3. **instance_status_logs** WHERE n_instance_id ORDER BY dt_changed_at → 각 행을 IStatusLog로 매핑:  
   - str_status, str_comment, dt_changed_at, n_changed_by_user_id → users 조인해 strChangedBy.  
   - qa_deployed/live_deployed 행은 **instance_execution_results** 1:1 조인 → objExecutionResult, **execution_query_parts** → arrQueryResults.
4. **처리자 8명**: n_creator_user_id … n_live_verifier_user_id 각각 **users** 조인 → IStageActor.  
   - dtProcessedAt: creator = event_instances.dt_created_at 또는 instance_status_logs(event_created).dt_changed_at; confirmer = instance_status_logs(str_status='dba_confirmed').dt_changed_at; … 동일 패턴.

### 7.4 Controller·데이터 레이어 대응

| 현재 코드 (인메모리) | 정규화 DB 전환 시 |
|----------------------|-------------------|
| productController: arrProducts.push, fnSaveProducts | products INSERT + product_services INSERT (기존 서비스 삭제 후 재등록) |
| userController: arrUsers, arrRoles 참조 | users CRUD + user_roles 조회/INSERT/DELETE, role_permissions로 권한 합집합 계산 |
| eventInstanceController: arrStatusLogs.push | instance_status_logs INSERT, (실행 시) instance_execution_results + execution_query_parts INSERT |
| eventInstanceController: objInstance.objQaDeployer = objActor 등 | event_instances.n_qa_deployer_user_id = req.user.nId UPDATE |
| eventInstanceController: objInstance.arrDeployScope = arr | instance_deploy_scopes DELETE 후 INSERT (해당 n_instance_id, str_env) |

### 7.5 정리

- **정규화 최종 스키마**(schema_normalized.sql)는 위 인메모리·코드와 **동일 관계·필드**를 유지하도록 설계됨.
- **관계도**: products ↔ product_services, users ↔ user_roles ↔ roles, roles ↔ role_permissions, event_instances ↔ instance_deploy_scopes / instance_status_logs / instance_execution_results / users(처리자) 가 코드의 참조 구조와 일치함.
- 전환 시 **기존 API 응답 형식(IEventInstance, IUser, IRole 등)** 은 Repository/서비스에서 위 조립 규칙으로 그대로 유지 가능.
