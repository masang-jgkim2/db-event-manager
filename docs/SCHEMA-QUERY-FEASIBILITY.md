# 제안 스키마 기준 조회 가능 여부 정리

> 정규화 스키마(schema_normalized.sql)로 각 요구 조회가 가능한지 항목별 정리 (2026-03-10)

---

## 1. 프로젝트(프로덕트) 기준

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **프로젝트마다 진행 중 / 완료 / 전체 이벤트 수** | 가능 | `event_instances` WHERE `n_product_id` = ?<br>• 진행 중: `str_status` <> 'live_verified' → COUNT<br>• 완료: `str_status` = 'live_verified' → COUNT<br>• 전체: COUNT(*) |
| **선택된 프로젝트의 이벤트(인스턴스) 모두 보기** | 가능 | `event_instances` WHERE `n_product_id` = ? ORDER BY dt_created_at 등 |
| **선택된 프로젝트의 실행된 쿼리 모두 보기** | 가능 | `event_instances` (n_product_id) JOIN `instance_status_logs` ON ei.n_id = isl.n_instance_id JOIN `instance_execution_results` ON isl.n_id = ier.n_status_log_id WHERE ei.n_product_id = ? → 실행된 쿼리(성공 건) 목록·상세 |
| **선택된 프로젝트의 쿼리 성공/실패 확인** | 부분 가능 | • **성공**: `instance_execution_results`에 해당 status_log에 대한 행 존재 여부로 판단 가능.<br>• **실패**: 현재 스키마에는 실패 이력 저장 없음. 실패도 남기려면 `instance_execution_results`에 b_success, str_error 추가 후 실행 시마다 INSERT하거나, 별도 실행 시도 테이블 필요. |

---

## 2. 배포 범위(국내/해외 등)

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **국내·해외 등 배포 범위마다 이벤트 모두 보기** | 가능 | • **서비스 지역(국내/스팀/글로벌 등)**: `event_instances.str_service_region` = '국내' 등으로 필터.<br>• **환경(qa/live)**: `instance_deploy_scopes.str_env` = 'qa' | 'live' 로 해당 반영 범위 인스턴스만 조회 후 `event_instances`와 조인. |

---

## 3. 쿼리 템플릿

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **쿼리 템플릿 누가 만들었는가 / 수정 / 삭제** | audit_logs 사용 시 가능 | `event_templates`에는 생성자·수정자 컬럼 없음. **audit_logs**에서 str_entity = 'event_template', str_action = 'create' \| 'update' \| 'delete', n_entity_id = 템플릿 ID, n_actor_user_id로 누가 했는지 조회. |
| **선택된 프로덕트의 모든 쿼리 템플릿 보기** | 가능 | `event_templates` WHERE `n_product_id` = ? |

---

## 4. DB 접속 정보

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **DB 접속 정보 누가 만들었는가 / 수정 / 삭제** | audit_logs 사용 시 가능 | `db_connections`에는 생성자 없음. **audit_logs**에서 str_entity = 'db_connection', str_action = 'create' \| 'update' \| 'delete', n_entity_id = 접속 정보 ID, n_actor_user_id로 조회. |

---

## 5. 사용자·역할

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **사용자 추가 / 수정 / 삭제 확인** | audit_logs 사용 시 가능 | **audit_logs** WHERE str_entity = 'user', str_action = 'create' \| 'update' \| 'delete', n_entity_id = 사용자 ID (삭제 시 대상 사용자 ID 등). n_actor_user_id = 행위자. |
| **역할·권한 추가 / 수정 / 삭제 확인** | audit_logs 사용 시 가능 | **audit_logs** WHERE str_entity IN ('role', 'user_role'), str_action = 'permission_change' \| 'role_assign' 등, n_entity_id = role_id 또는 user_id. 현재 상태는 role_permissions, user_roles; 변경 이력은 audit_logs. |
| **역할 코드를 가진 모든 사용자 보기** | 가능 | `user_roles` JOIN `roles` ON user_roles.n_role_id = roles.n_id WHERE roles.str_code = ? → 해당 사용자들. |

---

## 6. 사용자 관여 이벤트

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **사용자가 관여한(생성, 삭제, 수정, 컨펌, 반영 등) 모든 이벤트 보기** | 가능 | • **생성**: `event_instances` WHERE n_created_by_user_id = ?<br>• **컨펌/요청/반영/확인**: event_instances WHERE n_confirmer_user_id = ? OR n_qa_requester_user_id = ? OR n_qa_deployer_user_id = ? OR n_qa_verifier_user_id = ? OR n_live_requester_user_id = ? OR n_live_deployer_user_id = ? OR n_live_verifier_user_id = ?<br>• **상태 변경 전반(수정·쿼리수정 포함)**: `instance_status_logs` WHERE n_changed_by_user_id = ? 후 event_instances 조인.<br>위를 UNION 또는 하나의 쿼리로 묶어서 “해당 사용자가 관여한 인스턴스” 목록 조회. |

---

## 7. 이벤트(인스턴스) 생성·수정·삭제·상태

| 질의 | 가능 여부 | 조회 방법 |
|------|-----------|-----------|
| **이벤트 생성 확인** | 가능 | `event_instances.dt_created_at`, n_created_by_user_id. 생성 이력은 `instance_status_logs`에서 str_status = 'event_created'인 행으로도 확인 가능. |
| **이벤트 수정 확인** | 가능 | `instance_status_logs`에서 해당 n_instance_id에 대한 수정 관련 로그(str_comment에 'DBA 쿼리 직접 수정' 등). event_created 단계 일반 수정은 필요 시 audit_logs에 'event_instance', 'update' 로 남기면 보완 가능. |
| **이벤트 삭제 확인** | audit_logs 사용 시 가능 | 인스턴스 물리 삭제 시 **audit_logs**에 str_entity = 'event_instance', str_action = 'delete', n_entity_id = 인스턴스 ID 기록하면 누가 언제 삭제했는지 조회 가능. (현재 스키마만으로는 삭제 이력 없음.) |
| **이벤트 상태 선택된 상태만 보기** | 가능 | `event_instances` WHERE `str_status` = ? (예: 'qa_deployed', 'live_verified' 등). |

---

## 8. 요약 표

| 구분 | 항목 | 가능 | 비고 |
|------|------|------|------|
| 프로덕트 | 진행중/완료/전체 이벤트 수 | 예 | event_instances, n_product_id, str_status |
| 프로덕트 | 선택 프로젝트 이벤트 모두 보기 | 예 | event_instances WHERE n_product_id |
| 프로덕트 | 선택 프로젝트 실행된 쿼리 모두 보기 | 예 | event_instances + instance_status_logs + instance_execution_results |
| 프로덕트 | 쿼리 성공/실패 확인 | 부분 | 성공 = execution_results 존재; 실패 = 스키마 보완 필요 |
| 배포 범위 | 국내·해외 등별 이벤트 보기 | 예 | str_service_region, instance_deploy_scopes.str_env |
| 쿼리 템플릿 | 누가 만들었는가/수정/삭제 | audit_logs | audit_logs에 event_template CRUD 기록 |
| 쿼리 템플릿 | 선택 프로덕트의 모든 템플릿 | 예 | event_templates WHERE n_product_id |
| DB 접속 | 누가 만들었는가/수정/삭제 | audit_logs | audit_logs에 db_connection CRUD 기록 |
| 사용자 | 추가/수정/삭제 확인 | audit_logs | audit_logs에 user CRUD 기록 |
| 역할 | 권한 추가/수정/삭제 확인 | audit_logs | audit_logs에 role/user_role 변경 기록 |
| 역할 | 역할 코드별 모든 사용자 | 예 | user_roles + roles.str_code |
| 사용자 관여 | 관여한 모든 이벤트 보기 | 예 | event_instances(생성자+8처리자 FK) + instance_status_logs(n_changed_by_user_id) |
| 이벤트 | 생성/수정/삭제 확인 | 생성·수정 예, 삭제 audit_logs | 삭제는 audit_logs에 기록 시 가능 |
| 이벤트 | 선택된 상태만 보기 | 예 | event_instances WHERE str_status = ? |

---

## 9. 스키마 보완 제안 (선택)

- **쿼리 실패 이력**: `instance_execution_results`에 `b_success` TINYINT(1), `str_error` TEXT 추가 후, 실행 시마다(성공/실패 모두) 1건 INSERT. 또는 실행 시도 전용 테이블을 두고 성공 시에만 기존 instance_execution_results와 연결.
- **이벤트 인스턴스 삭제 이력**: 물리 삭제 대신 soft delete(예: b_deleted, dt_deleted_at, n_deleted_by_user_id)를 두거나, 삭제 시 audit_logs에만 기록.

이 보완까지 반영하면 위 표의 "부분 가능"·"audit_logs 사용 시 가능" 항목을 모두 "가능"으로 통일할 수 있음.
