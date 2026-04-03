# 로그 요구사항 vs 정규화 스키마 검토

> "한 사용자의 모든 로그" 및 "프로덕트/이벤트 기준 집계·로그"가 현재 정규화 테이블로 가능한지 검토 (2026-03-10)

---

## 1. 로그 요구 목록 정리

### 1.1 한 사용자 기준 — 보고 싶은 로그

| 구분 | 로그 항목 | 설명 |
|------|-----------|------|
| **사용자** | 생성, 수정, 삭제 | 사용자 계정 CRUD |
| **사용자** | 로그인, 로그아웃 | 인증 이벤트 |
| **프로덕트** | 생성, 수정, 삭제 | 프로덕트 CRUD |
| **DB 접속** | 생성, 수정, 삭제 | db_connections CRUD |
| **쿼리 템플릿** | 생성, 수정, 삭제 | event_templates CRUD |
| **이벤트 인스턴스** | 생성 | 이벤트(인스턴스) 생성 |
| **이벤트 인스턴스** | 수정 | event_created 단계에서의 수정 |
| **이벤트 인스턴스** | 반영 | QA/LIVE 쿼리 실행 (qa_deployed, live_deployed) |
| **이벤트 인스턴스** | 완료 | live_verified 등 상태 전이 |
| **이벤트 인스턴스** | 쿼리 수정 | DBA 쿼리 직접 수정 (str_comment에 기록) |
| **권한/역할** | 권한 수정 | 역할별 권한 변경, 사용자별 역할 변경 |

### 1.2 프로덕트/이벤트 기준 — 보고 싶은 통계·로그

| 구분 | 항목 | 설명 |
|------|------|------|
| **프로덕트** | 선택된 프로덕트의 이벤트(인스턴스) 진행 중 개수 | str_status != 'live_verified', n_product_id = ? |
| **프로덕트** | 선택된 프로덕트의 이벤트 완료 개수 | str_status = 'live_verified', n_product_id = ? |
| **프로덕트** | 프로덕트별 진행 이벤트 수 / 완료 이벤트 수 | n_product_id별 COUNT, GROUP BY |
| **쿼리 템플릿** | 특정 쿼리 템플릿 기준 진행 중·완료 인스턴스 수 | n_event_template_id + str_status 기준 |
| **이벤트 인스턴스** | 전체 이벤트 로그 (기간/사용자/상태 필터) | 상태 변경 이력 조회 |

---

## 2. 현재 정규화 스키마로 가능한 로그 (가능)

아래는 **지금 schema_normalized.sql만으로** 조회·집계 가능.

### 2.1 이벤트 인스턴스 관련 (한 사용자 / 전체)

| 로그 항목 | 테이블·조건 | 비고 |
|-----------|-------------|------|
| **이벤트 인스턴스 생성** (누가/언제) | event_instances.n_created_by_user_id, dt_created_at | "이 사용자가 생성한 인스턴스" 조회 가능 |
| **상태 변경 전반** (반영, 완료, 쿼리 수정 포함) | instance_status_logs (n_changed_by_user_id, str_status, str_comment, dt_changed_at) | 반영=qa_deployed/live_deployed, 완료=live_verified, 쿼리 수정=str_comment 'DBA 쿼리 직접 수정' |
| **실행 결과** (건수, 소요시간, 쿼리) | instance_status_logs + instance_execution_results + execution_query_parts | QA/LIVE 실행 로그 상세 |
| **한 사용자의 모든 인스턴스 관련 행위** | instance_status_logs WHERE n_changed_by_user_id = ? + event_instances WHERE n_created_by_user_id = ? 및 8개 처리자 FK | "이 사용자 로그" 중 **이벤트 인스턴스 부분만** 가능 |

### 2.2 프로덕트/이벤트 기준 집계

| 항목 | 쿼리 요약 | 비고 |
|------|------------|------|
| **선택된 프로덕트의 진행 중 이벤트 수** | event_instances WHERE n_product_id = ? AND str_status <> 'live_verified' → COUNT | 가능 |
| **선택된 프로덕트의 완료 이벤트 수** | event_instances WHERE n_product_id = ? AND str_status = 'live_verified' → COUNT | 가능 |
| **프로덕트별 진행/완료 수** | event_instances GROUP BY n_product_id, str_status (또는 CASE WHEN str_status='live_verified') → COUNT | 가능 |
| **특정 쿼리 템플릿 기준 진행 중·완료 인스턴스 수** | event_instances WHERE n_event_template_id = ? + str_status 조건 → COUNT | 가능 |
| **전체 이벤트 로그** (기간/사용자/상태) | instance_status_logs + event_instances 조인, WHERE dt_changed_at, n_changed_by_user_id, str_status | 가능 |

---

## 3. 현재 정규화 스키마로 불가능한 로그 (감사 테이블 필요)

아래는 **현재 스키마에 "누가 언제 무엇을 했는지" 기록하는 테이블이 없어** 불가.

| 로그 항목 | 부족한 점 |
|-----------|-----------|
| **사용자 생성/수정/삭제** | users 테이블은 현재 상태만 보관. "누가 어떤 사용자를 언제 생성/수정/삭제했는지" 이력 없음. |
| **로그인/로그아웃** | 인증 시 로그 기록 없음. |
| **프로덕트 생성/수정/삭제** | products는 현재 상태만. 변경 이력 없음. |
| **DB 접속 생성/수정/삭제** | db_connections 동일. |
| **쿼리 템플릿 생성/수정/삭제** | event_templates 동일. |
| **권한 수정** (역할별 권한, 사용자별 역할) | role_permissions, user_roles는 현재 상태만. "누가 언제 추가/삭제했는지" 없음. |

정리하면, **한 사용자의 모든 로그** 중  
- **이벤트 인스턴스(생성, 상태 변경, 반영, 완료, 쿼리 수정)** → **가능**  
- **사용자/프로덕트/DB접속/쿼리 템플릿 CRUD, 로그인·로그아웃, 권한 수정** → **불가** (감사 로그 테이블 추가 필요)

---

## 4. 감사 로그 테이블 제안 (불가 로그를 가능하게)

"한 사용자의 모든 로그"와 엔티티별 변경 이력을 지원하려면 **공통 감사 로그 테이블** 또는 엔티티별 로그 테이블이 필요함.

### 4.1 방안 A: 공통 audit_log 한 테이블

한 테이블에 모든 "누가, 언제, 어떤 엔티티에, 어떤 행위를 했는지" 기록.

```sql
CREATE TABLE audit_logs (
  n_id              INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  n_actor_user_id   INT           NOT NULL COMMENT '행위자 사용자 ID',
  str_entity        VARCHAR(50)   NOT NULL COMMENT '대상 엔티티: user | product | db_connection | event_template | role | user_role | login | logout',
  n_entity_id       INT           NULL COMMENT '대상 레코드 PK (login/logout 등은 NULL)',
  str_action        VARCHAR(30)   NOT NULL COMMENT 'create | update | delete | login | logout | role_assign | permission_change',
  str_detail        TEXT          NULL COMMENT '요약 또는 변경 요약 (선택)',
  dt_created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (n_actor_user_id) REFERENCES users(n_id) ON DELETE RESTRICT,
  INDEX idx_actor (n_actor_user_id),
  INDEX idx_entity (str_entity, n_entity_id),
  INDEX idx_dt (dt_created_at)
);
```

- **한 사용자의 모든 로그**: `WHERE n_actor_user_id = ? ORDER BY dt_created_at DESC`
- **로그인/로그아웃**: str_entity = 'login' | 'logout', n_entity_id = NULL 또는 n_actor_user_id 중복 저장
- **권한 수정**: str_entity = 'user_role' | 'role', str_action = 'role_assign' | 'permission_change', n_entity_id = 대상 user_id 또는 role_id

### 4.2 방안 B: 엔티티별 로그 테이블

- user_audit_logs (대상 n_user_id, 행위자 n_actor_user_id, str_action, dt)
- product_audit_logs
- db_connection_audit_logs
- event_template_audit_logs
- role_audit_logs / user_role_audit_logs
- auth_logs (login/logout, n_user_id, str_action, dt)

"한 사용자 로그"는 각 테이블에서 n_actor_user_id = ? (또는 로그인은 auth_logs에서 n_user_id = ?) 조회 후 UNION + 정렬로 구현 가능.

---

## 5. 정규화 스키마 + 감사 로그 반영 시 가능 여부 요약

| 로그/집계 | 현재 정규화만 | 감사 로그 추가 후 |
|-----------|----------------|-------------------|
| 한 사용자: 이벤트 인스턴스 생성/수정/반영/완료/쿼리 수정 | 가능 | 가능 |
| 한 사용자: 사용자/프로덕트/DB접속/쿼리 템플릿 CRUD | 불가 | 가능 |
| 한 사용자: 로그인/로그아웃 | 불가 | 가능 |
| 한 사용자: 권한(역할) 수정 | 불가 | 가능 |
| 프로덕트별 진행 중/완료 이벤트 수 | 가능 | 가능 |
| 특정 쿼리 템플릿 기준 진행·완료 인스턴스 수 | 가능 | 가능 |
| 전체 이벤트 로그 (기간/사용자/상태) | 가능 | 가능 |

---

## 6. 결론 및 권장

- **현재 정규화 테이블만으로**:  
  - **이벤트 인스턴스** 관련 로그(생성, 상태 변경, 반영, 완료, 쿼리 수정)와 **프로덕트/쿼리 템플릿 기준 진행·완료 집계**는 **가능**.  
  - **한 사용자의 모든 로그** 중 사용자 CRUD, 로그인/로그아웃, 프로덕트/DB접속/쿼리 템플릿 CRUD, 권한 수정은 **불가**.

- **반영**:  
  - **audit_logs** 테이블을 **schema_normalized.sql**에 추가해 두었음.  
  - 사용자/프로덕트/DB접속/쿼리 템플릿/역할 CRUD 및 로그인·로그아웃 시마다 1건 INSERT하면 "한 사용자의 모든 로그"를 audit_logs + instance_status_logs 통합 조회로 제공 가능.

### 한 사용자 전체 로그 조회 방식 (audit_logs 반영 후)

- **이벤트 인스턴스 관련**: `instance_status_logs` (n_changed_by_user_id = ?) + 필요 시 `event_instances` (n_created_by_user_id 또는 8개 처리자 FK = ?).
- **그 외 (CRUD, 로그인/로그아웃, 권한)**: `audit_logs` (n_actor_user_id = ?).
- 화면에서는 두 결과를 dt_created_at / dt_changed_at 기준으로 합쳐서 시간순 정렬해 "한 사용자의 모든 로그"로 표시하면 됨.
