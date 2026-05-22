# 권한·메뉴·페이지·버튼/액션 정리 (세분화)

모든 메뉴, 페이지, 버튼/기능을 **보기·생성·수정·삭제** 등 세분화된 권한 단위로 정리한 문서입니다.

## 원칙: 메뉴·페이지 접근

- **모든 메뉴와 페이지는 해당 도메인의 보기 권한이 있어야 노출·접근 가능**합니다.
- **보기 권한이 없으면** 해당 메뉴는 사이드바에 보이지 않으며, URL로 직접 접근해도 403 접근 권한 없음 페이지가 표시됩니다.
- 예: 프로덕트 메뉴/페이지 → `product.view` 필요. 사용자 메뉴/페이지 → `user.view` 필요.

---

## 1. 세분화 권한 코드 제안

아래는 **메뉴/페이지별 보기·생성·수정·삭제·기타 액션**에 대응하는 권한 코드 제안입니다.  
(현재 코드와 매핑은 §3 참고.)

| 도메인 | 권한 코드 | 표시명 | 비고 |
|--------|-----------|--------|------|
| **대시보드** | `dashboard.view` | 대시보드 보기 | 관리자 전용 대시보드 페이지 |
| **프로덕트** | `product.view` | 프로덕트 보기 | 목록·상세 조회 |
| | `product.create` | 프로덕트 생성 | 새로운 프로덕트 추가 |
| | `product.edit` | 프로덕트 수정 | 관리-수정 |
| | `product.delete` | 프로덕트 삭제 | 관리-삭제 |
| **쿼리 템플릿** | `event_template.view` | 쿼리 템플릿 보기 | 목록·상세 조회 |
| | `event_template.create` | 쿼리 템플릿 생성 | 새로운 쿼리 템플릿 추가 |
| | `event_template.edit` | 쿼리 템플릿 수정 | 관리-수정 |
| | `event_template.delete` | 쿼리 템플릿 삭제 | 관리-삭제 |
| **DB 접속 정보** | `db_connection.view` | DB 접속 보기 | 목록·상세 조회 |
| | `db_connection.create` | DB 접속 생성 | 새 접속 정보 추가 |
| | `db_connection.edit` | DB 접속 수정 | 관리-수정 |
| | `db_connection.delete` | DB 접속 삭제 | 관리-삭제 |
| | `db_connection.test` | DB 연결 테스트 | 연결 테스트 버튼 |
| **사용자 관리** | `user.view` | 사용자 보기 | 목록·상세 조회 |
| | `user.create` | 사용자 생성 | 사용자 추가 |
| | `user.edit` | 사용자 수정 | 이름·역할 수정 |
| | `user.delete` | 사용자 삭제 | 사용자 삭제 |
| | `user.reset_password` | 비밀번호 초기화 | 비밀번호 초기화 |
| **역할 권한** | `role.view` | 역할 보기 | 목록·상세 조회 |
| | `role.create` | 역할 생성 | 새로운 역할 추가 |
| | `role.edit` | 역할 수정 | 역할 정보 수정(커스텀 역할) |
| | `role.delete` | 역할 삭제 | 역할 삭제(커스텀만) |
| | `role.edit_permissions` | 역할 권한 수정 | 시스템 역할 포함 권한 체크박스 |
| **나의 대시보드** | `my_dashboard.view` | 나의 대시보드 보기 | 목록·탭·필터·통계 |
| | `my_dashboard.detail` | 상세 | 상세 버튼·모달 |
| | `my_dashboard.edit` | 이벤트 수정 | 작성 중인 본인 인스턴스 수정 |
| | `my_dashboard.request_confirm` | 컨펌 요청 | 컨펌 요청 버튼 |
| | `my_dashboard.query_edit` | 쿼리 수정 | DBA 쿼리 직접 수정 |
| | `my_dashboard.confirm` | DBA 컨펌 | 컨펌(확인) 버튼 |
| | `my_dashboard.request_qa` | QA 반영 요청 | QA반영 요청 버튼 |
| | `my_dashboard.execute_qa` | QA 반영 실행 | QA DB 실행(반영) 버튼 |
| | `my_dashboard.verify_qa` | QA 확인 | QA확인 버튼 |
| | `my_dashboard.request_qa_rereq` | QA 재반영 요청 | QA 재반영 요청 버튼 |
| | `my_dashboard.request_live` | LIVE 반영 요청 | LIVE반영 요청 버튼 |
| | `my_dashboard.execute_live` | LIVE 반영 실행 | LIVE DB 실행(반영) 버튼 |
| | `my_dashboard.verify_live` | LIVE 확인 | LIVE확인 버튼 |
| | `my_dashboard.request_live_rereq` | LIVE 재반영 요청 | LIVE 재반영 요청 버튼 |
| | `my_dashboard.hide` | 완료 이벤트 숨기기 | 숨기기/복원 |
| **이벤트 생성** | `instance.view` | 이벤트 생성 보기 | 이벤트 생성 페이지 진입·조회 |
| | `instance.create` | 이벤트 생성 | 새 이벤트 인스턴스 생성(쿼리 작성·제출) |

---

## 2. 메뉴·페이지별 기능 정리 (UI 기준)

아래는 **메뉴 → 페이지 → 보기/생성/수정/삭제/기타** 단위로 나열한 것입니다.

---

### 2.1 이벤트 대시보드 (관리자 대시보드)

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 대시보드 보기 | 프로덕트·이벤트 요약 등 대시보드 페이지 진입 및 조회 | `dashboard.view` |

- **메뉴**: 대시보드 (경로 `/`)  
- **메뉴·페이지 접근**: `dashboard.view` (또는 역할 `admin`). **보기 권한 없으면 메뉴 비노출·페이지 403**

---

### 2.2 프로덕트

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 프로덕트 보기 | 목록 조회, 상세 조회 | `product.view` |
| 생성 | 프로덕트 생성 | 새로운 프로덕트 추가(추가 버튼 → 모달) | `product.create` |
| 수정 | 프로덕트 수정 | 관리-수정(수정 버튼 → 모달) | `product.edit` |
| 삭제 | 프로덕트 삭제 | 관리-삭제(삭제 버튼) | `product.delete` |

- **메뉴**: 프로덕트 (경로 `/products`)  
- **메뉴·페이지 접근**: `product.view` **필수**. 보기 권한 없으면 메뉴 비노출·페이지 403

---

### 2.3 쿼리 템플릿

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 쿼리 템플릿 보기 | 목록 조회, 상세 조회 | `event_template.view` |
| 생성 | 쿼리 템플릿 생성 | 새로운 쿼리 템플릿 추가(추가 버튼 → 모달) | `event_template.create` |
| 수정 | 쿼리 템플릿 수정 | 관리-수정(수정 버튼 → 모달) | `event_template.edit` |
| 삭제 | 쿼리 템플릿 삭제 | 관리-삭제(삭제 버튼) | `event_template.delete` |

- **메뉴**: 쿼리 템플릿 (경로 `/events`)  
- **메뉴·페이지 접근**: `event_template.view` **필수**. 보기 권한 없으면 메뉴 비노출·페이지 403

---

### 2.4 DB 접속 정보

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | DB 접속 보기 | 목록 조회, 상세(모달) 조회 | `db_connection.view` |
| 생성 | DB 접속 생성 | 새 접속 정보 추가(추가 버튼 → 모달) | `db_connection.create` |
| 수정 | DB 접속 수정 | 관리-수정(수정 버튼 → 모달) | `db_connection.edit` |
| 삭제 | DB 접속 삭제 | 관리-삭제(삭제 버튼) | `db_connection.delete` |
| 기타 | 연결 테스트 | 연결 테스트 버튼 | `db_connection.test` |

- **메뉴**: DB 접속 정보 (경로 `/db-connections`)  
- **메뉴·페이지 접근**: `db_connection.view`(또는 `db.manage`) **필수**. 보기 권한 없으면 메뉴 비노출·페이지 403

---

### 2.5 사용자 관리

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 사용자 보기 | 목록 조회, 상세(모달) 조회 | `user.view` |
| 생성 | 사용자 생성 | 사용자 추가(추가 버튼 → 모달) | `user.create` |
| 수정 | 사용자 수정 | 이름·역할 수정(수정 버튼 → 모달) | `user.edit` |
| 삭제 | 사용자 삭제 | 사용자 삭제(삭제 버튼) | `user.delete` |
| 기타 | 비밀번호 초기화 | 비밀번호 초기화(모달) | `user.reset_password` |

- **메뉴**: 사용자 (경로 `/users`)  
- **메뉴·페이지 접근**: `user.view` **필수**. 보기 권한 없으면 메뉴 비노출·페이지 403

---

### 2.6 역할 권한 관리

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 역할 보기 | 목록 조회, 상세(모달) 조회 | `role.view` |
| 생성 | 역할 생성 | 새로운 역할 추가(추가 버튼 → 모달) | `role.create` |
| 수정 | 역할 수정 | 역할 정보 수정(커스텀 역할만, 수정 버튼 → 모달) | `role.edit` |
| 삭제 | 역할 삭제 | 역할 삭제(커스텀 역할만, 삭제 버튼) | `role.delete` |
| 기타 | 역할 권한 수정 | 시스템 역할의 권한 체크박스 수정(권한 버튼 → 모달) | `role.edit_permissions` |

- **메뉴**: 역할 권한 (경로 `/roles`)  
- **메뉴·페이지 접근**: `role.view` **필수**. 보기 권한 없으면 메뉴 비노출·페이지 403

---

### 2.7 나의 대시보드

| 구분 | 기능 | 설명 | 제안 권한 / 비고 |
|------|------|------|-------------------|
| 보기 | 나의 대시보드 보기 | 목록, 탭(진행/완료·숨김), 필터, 통계 | `my_dashboard.view` |
| 기타 | 상세 | 상세 버튼 → 모달 | `my_dashboard.detail` |
| 수정 | 이벤트 수정 | event_created 상태, 본인이 생성한 인스턴스만 수정 버튼 | `my_dashboard.edit` (현재 `instance.create` + 본인) |
| 기타 | 컨펌 요청 | 컨펌 요청 버튼 | `my_dashboard.request_confirm` (현재 `instance.create`) |
| 기타 | 쿼리 수정 | DBA 쿼리 직접 수정 버튼(confirm_requested, qa_requested, live_requested) | `my_dashboard.query_edit` (현재 역할 dba/admin) |
| 기타 | DBA 컨펌 | 컨펌(확인) 버튼(confirm_requested 상태) | `my_dashboard.confirm` (현재 execute_qa/execute_live 또는 dba/admin) |
| 기타 | QA 반영 요청 | QA반영 요청 버튼(dba_confirmed, 반영범위 QA) | `my_dashboard.request_qa` (현재 `instance.approve_qa`) |
| 기타 | LIVE 반영 요청(QA 스킵) | LIVE반영 요청 버튼(dba_confirmed, LIVE만) | `my_dashboard.request_live` (현재 `instance.approve_live`) |
| 기타 | QA 반영 실행 | QA 반영(실행) 버튼(qa_requested) | `my_dashboard.execute_qa` (현재 `instance.execute_qa` 또는 dba/admin) |
| 기타 | QA 확인 | QA확인 버튼(qa_deployed) | `my_dashboard.verify_qa` |
| 기타 | QA 재반영 요청 | QA 재반영 요청(팝업 내 또는 qa_verified) | `my_dashboard.request_qa_rereq` (현재 `instance.approve_qa`) |
| 기타 | LIVE 반영 요청 | LIVE반영 요청 버튼(qa_verified 등) | `my_dashboard.request_live` |
| 기타 | LIVE 반영 실행 | LIVE 반영(실행) 버튼(live_requested) | `my_dashboard.execute_live` (현재 `instance.execute_live` 또는 dba/admin) |
| 기타 | LIVE 확인 | LIVE확인 버튼(live_deployed) | `my_dashboard.verify_live` |
| 기타 | LIVE 재반영 요청 | LIVE 재반영 요청(팝업 내 또는 live_verified) | `my_dashboard.request_live_rereq` (현재 `instance.approve_live`) |
| 기타 | 완료 이벤트 숨기기/복원 | 숨기기·복원 버튼 | `my_dashboard.hide` (또는 view에 포함) |

- **메뉴**: 나의 대시보드 (경로 `/my-dashboard`)  
- **페이지 접근**: `my_dashboard.view` 필수 (없으면 메뉴 비노출·페이지 403)  
- **상태별 노출**: 위 표의 기능은 인스턴스 상태(strStatus)와 반영 범위(qa/live)에 따라 조건부 노출됨.

---

### 2.8 이벤트 생성

| 구분 | 기능 | 설명 | 제안 권한 |
|------|------|------|-----------|
| 보기 | 이벤트 생성 페이지 보기 | 페이지 진입(이벤트·프로덕트 선택, 쿼리 작성 영역 조회) | `instance.view` |
| 생성 | 이벤트 인스턴스 생성 | 쿼리 작성 후 생성(제출) 버튼으로 새 인스턴스 생성 | `instance.create` |

- **메뉴**: 이벤트 생성 (경로 `/query`)  
- **메뉴·페이지 접근**: `instance.view` 또는 `instance.create` **필수**. 둘 다 없으면 메뉴 비노출·페이지 403

---

## 3. 현재 권한 코드 ↔ 세분화 권한 매핑

구현 시 **기존 코드**를 유지하면서 **세분화 권한**을 단계적으로 도입할 수 있도록 매핑 예시를 둡니다.

| 현재 권한 코드 | 세분화 시 대응 권한 (제안) |
|----------------|----------------------------|
| (역할 admin) | dashboard.view, product.*, event_template.*, db_connection.*, user.*, role.*, my_dashboard.*, instance.create |
| `product.view` | `product.view` |
| `product.manage` | `product.view`, `product.create`, `product.edit`, `product.delete` |
| `event_template.view` | `event_template.view` |
| `event_template.manage` | `event_template.view`, `event_template.create`, `event_template.edit`, `event_template.delete` |
| `user.manage` | `user.view`, `user.create`, `user.edit`, `user.delete`, `user.reset_password` |
| `db.manage` | `db_connection.view`, `db_connection.create`, `db_connection.edit`, `db_connection.delete`, `db_connection.test` |
| `instance.view` | `instance.view` (이벤트 생성 페이지 보기 전용) |
| `instance.create` | `instance.view`, `instance.create`, `my_dashboard.edit`, `my_dashboard.request_confirm` |
| `instance.approve_qa` | `my_dashboard.request_qa`, `my_dashboard.request_qa_rereq` (및 관련 UI) |
| `instance.execute_qa` | `my_dashboard.execute_qa`, `my_dashboard.query_edit`, `my_dashboard.confirm` (역할 dba와 함께) |
| `instance.verify_qa` | `my_dashboard.verify_qa` |
| `instance.approve_live` | `my_dashboard.request_live`, `my_dashboard.request_live_rereq` |
| `instance.execute_live` | `my_dashboard.execute_live` |
| `instance.verify_live` | `my_dashboard.verify_live` |

- 역할 **dba**는 `my_dashboard.query_edit`, `my_dashboard.confirm`, `my_dashboard.execute_qa`, `my_dashboard.execute_live`를 역할로 보유한다고 두고, 세분화 후에는 해당 권한 코드를 dba 역할에 부여하는 방식으로 정리할 수 있습니다.

---

## 4. 메뉴 노출·페이지 접근 조건 (보기 권한 필수)

| 메뉴 라벨 | 경로 | 필요 권한 (보기 권한 없으면 메뉴 비노출·페이지 403) |
|-----------|------|-----------------------------------------------------|
| 대시보드 | `/` | `dashboard.view` (또는 역할 `admin`) |
| 프로덕트 | `/products` | `product.view` |
| 쿼리 템플릿 | `/events` | `event_template.view` |
| DB 접속 정보 | `/db-connections` | `db_connection.view` 또는 `db.manage` |
| 사용자 | `/users` | `user.view` |
| 역할 권한 | `/roles` | `role.view` |
| 나의 대시보드 | `/my-dashboard` | `my_dashboard.view` |
| 이벤트 생성 | `/query` | `instance.view` 또는 `instance.create` |

---

## 5. 역할별 요약 (세분화 권한 적용 시 예시)

| 역할 | 대시보드 | 프로덕트 | 쿼리 템플릿 | DB접속 | 사용자 | 역할 권한 | 나의 대시보드 | 이벤트 생성 |
|------|----------|----------|----------------|--------|--------|----------|----------------|-------------|
| **admin** | 보기 | 보기·생성·수정·삭제 | 보기·생성·수정·삭제 | 전부+테스트 | 전부+비밀초기화 | 전부+권한수정 | 전부 액션 | 보기·생성 |
| **dba** | — | — | — | — | — | — | 보기·상세·쿼리수정·컨펌·QA반영·LIVE반영·숨기기 | — |
| **game_manager** | — | 보기 | 보기 | — | — | — | 보기·상세·수정·컨펌요청·QA/LIVE 요청·확인·재요청·숨기기 | 보기·생성 |
| **game_designer** | — | 보기 | 보기 | — | — | — | 보기·상세·수정·컨펌요청·숨기기 | 보기·생성 |

이 문서는 세분화 권한 **설계·정리**용이며, 실제 라우트/버튼 노출은 백엔드·프론트엔드에 위 권한을 반영한 뒤 구현하면 됩니다.

---

## 6. 최근 반영 사항 (구현 기준)

- **메뉴 라벨**: 프로덕트 관리 → 프로덕트, 사용자 관리 → 사용자, 역할 권한 관리 → 역할 권한.
- **보기 권한 필수**: 모든 메뉴/페이지는 해당 도메인 보기 권한 없으면 메뉴 비노출·직접 URL 403.
- **이벤트 생성**: instance.view(보기), instance.create(생성) 분리. 페이지는 둘 중 하나로 진입, 제출 버튼은 instance.create만.
- **DB 접속**: GET만 db_connection.view, POST/PUT/DELETE/test는 각각 create/edit/delete/test 권한. 버튼도 권한별 노출.
- **사용자/역할 페이지**: 추가·수정·삭제·비밀번호초기화·권한수정 버튼은 해당 권한 있을 때만 노출.
- **역할 권한 폼**: 저장된 권한만 초기값으로 표시(확장 없음). 제외한 권한이 다시 체크되지 않음.
- **나의 대시보드**: 상세 → my_dashboard.detail, 이벤트 수정 → my_dashboard.edit, 컨펌 요청 → my_dashboard.request_confirm. instance.create는 수정/컨펌 자동 부여 안 함. PUT 수정 API는 my_dashboard.edit 필수.
