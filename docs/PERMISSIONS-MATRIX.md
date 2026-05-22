# 권한 매트릭스 (API·화면·역할)

## 1. API ↔ 필요 권한

| API | 필요 권한 (하나라도 있으면 통과) |
|-----|----------------------------------|
| **프로덕트** | |
| GET /api/products | product.view, product.manage, product.create, product.edit, product.delete, dashboard.view |
| POST /api/products | product.manage, product.create |
| PUT /api/products/:id | product.manage, product.edit |
| DELETE /api/products/:id | product.manage, product.delete |
| **쿼리 템플릿** | |
| GET /api/events | event_template.view, event_template.manage, create, edit, delete, dashboard.view |
| POST /api/events | event_template.manage, event_template.create |
| PUT /api/events/:id | event_template.manage, event_template.edit |
| DELETE /api/events/:id | event_template.manage, event_template.delete |
| **이벤트 인스턴스 (나의 대시보드)** | |
| GET /api/event-instances/stream | my_dashboard.view |
| GET /api/event-instances | my_dashboard.view |
| GET /api/event-instances/:id | my_dashboard.view |
| POST /api/event-instances | instance.create |
| **PUT /api/event-instances/:id** | **my_dashboard.edit** (이벤트 수정) **또는 my_dashboard.query_edit** (DBA 쿼리 수정) |
| PATCH /api/event-instances/:id/status | (핸들러 내부) 상태별: request_confirm, confirm, request_qa, verify_qa, request_live, verify_live 등 |
| POST /api/event-instances/:id/execute | (핸들러 내부) qa → my_dashboard.execute_qa 또는 instance.execute_qa / live → execute_live |
| **DB 접속** | |
| GET /api/db-connections | db_connection.view, db.manage |
| POST/PUT/DELETE, POST :id/test | db_connection.create|edit|delete|test, db.manage |
| **사용자** | user.view / user.create / user.edit / user.delete / user.reset_password |
| **역할** | role.view / role.create / role.edit / role.delete |

## 2. 상태 전이 ↔ 권한 (PATCH status)

| 다음 상태 | 필요 권한 (역할 또는 권한) |
|-----------|----------------------------|
| confirm_requested | my_dashboard.request_confirm |
| dba_confirmed | my_dashboard.confirm |
| qa_requested | my_dashboard.request_qa |
| qa_verified | my_dashboard.verify_qa |
| live_requested | my_dashboard.request_live |
| live_verified | my_dashboard.verify_live |

역할은 전이 규칙에 따라 game_manager, game_designer, dba, admin 등으로 제한됨.

## 3. 메뉴 노출 (MainLayout)

| 메뉴 | 필요 권한 |
|------|-----------|
| 대시보드 | dashboard.view 또는 admin |
| 프로덕트 | product.view |
| 쿼리 템플릿 | event_template.view |
| DB 접속 정보 | db_connection.view 또는 db.manage |
| 사용자 | user.view |
| 역할 권한 | role.view |
| 나의 대시보드 | my_dashboard.view |
| 이벤트 생성 | instance.view 또는 instance.create |

## 4. 나의 대시보드 버튼/기능 (MyDashboardPage)

| 기능 | 필요 권한 |
|------|-----------|
| 상세 보기 | my_dashboard.detail |
| 쿼리 수정 (DBA) | dba/admin 역할 또는 my_dashboard.query_edit |
| 이벤트 수정·컨펌 요청 | my_dashboard.edit, my_dashboard.request_confirm |
| DBA 컨펌 | my_dashboard.confirm |
| QA/LIVE 요청·실행·확인 | request_qa, execute_qa, verify_qa, request_live, execute_live, verify_live 등 |

## 5. 시드 역할별 권한 (rolePermissions.ts)

- **admin (1)**: product, event_template, user.manage, db.manage, instance.create, my_dashboard.view/detail/edit/request_confirm, instance.approve_qa/execute_qa/verify_qa, approve_live/execute_live/verify_live
- **dba (2)**: instance.execute_qa, instance.execute_live, my_dashboard.view, my_dashboard.detail  
  → 로그인 시 확장(OBJ_EXPAND)으로 instance.execute_qa → my_dashboard.execute_qa, **my_dashboard.query_edit**, my_dashboard.confirm 부여
- **game_manager (3)**: product.view, event_template.view, instance.create, my_dashboard.view/detail/edit/request_confirm, instance.approve_qa/verify_qa, approve_live/verify_live (실행 제외)
- **game_designer (4)**: product.view, event_template.view, instance.create, my_dashboard.view/detail/edit/request_confirm

## 6. 원칙: 역할이 아닌 권한으로 수행 제어

- **원칙**: 모든 수행(상태 변경, 쿼리 수정, 실행, 수정 등)은 **역할(role)이 아니라 권한(permission)** 으로만 판단합니다. 역할은 권한을 묶은 그룹일 뿐입니다.
- **추가 권한**:
  - `my_dashboard.edit_any`: 타인이 생성한 이벤트(event_created) 수정 (기존 "admin만" → 권한으로 대체)
  - `system.save_test_seed`: 테스트 시드 저장 (기존 fnAdminOnly → 이 권한 필요로 변경)
- **변경 사항**: PATCH status, POST execute, PUT(쿼리 수정/일반 수정), 목록 필터(my_action) 모두 권한만 검사. 프론트 메뉴·버튼·리다이렉트도 권한만 사용.
