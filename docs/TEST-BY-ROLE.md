# 역할별 테스트 가이드 (관리자 / DBA / GM / 기획자)

**결론: 네. 관리자, DBA, GM, 기획자 네 가지 역할만으로 모든 메뉴·페이지·버튼을 테스트할 수 있습니다.**

---

## 1. 역할별 권한 요약 (시드 기준)

| 역할 | strCode | 권한 (요약) |
|------|---------|-------------|
| **관리자** | admin | 전부 (product/event_template/user/db/instance.*, my_dashboard.detail·edit·request_confirm 등) |
| **DBA** | dba | instance.execute_qa, instance.execute_live, my_dashboard.detail(상세) |
| **GM** | game_manager | product.view, event_template.view, instance.create, my_dashboard.detail·edit·request_confirm, approve_qa, verify_qa, approve_live, verify_live |
| **기획자** | game_designer | product.view, event_template.view, instance.create, my_dashboard.detail·edit·request_confirm |

---

## 2. 메뉴·페이지 접근 가능 역할

| 메뉴/페이지 | 경로 | 접근 조건 (보기 권한) |
|-------------|------|------------------------|
| 대시보드 | `/` | **관리자** (dashboard.view) |
| 프로덕트 | `/products` | product.view → 관리자, **GM**, **기획자** |
| 이벤트 템플릿 | `/events` | event_template.view → 관리자, **GM**, **기획자** |
| DB 접속 정보 | `/db-connections` | db_connection.view 또는 db.manage → **관리자** 등 |
| 사용자 | `/users` | user.view → **관리자** 등 |
| 역할 권한 | `/roles` | role.view → **관리자** 등 |
| 나의 대시보드 | `/my-dashboard` | my_dashboard.view → 관리자, **DBA**, **GM**, **기획자** |
| 이벤트 생성 | `/query` | instance.view 또는 instance.create → 관리자, **GM**, **기획자** |

- DBA는 **나의 대시보드**만 메뉴에 보이고, 프로덕트/이벤트/이벤트 생성 메뉴는 안 보입니다 (의도된 동작).

---

## 3. 페이지별 주요 버튼/기능 — 누가 테스트하는지

### 3.1 대시보드 (`/`)
- 전체 대시보드 표시, 프로덕트/이벤트 등 요약  
→ **관리자**로만 접근·테스트.

### 3.2 프로덕트 (`/products`)
- **목록/상세 조회**: product.view → 관리자, GM, 기획자
- **추가/수정/삭제**: product.create / edit / delete (또는 product.manage) → 버튼은 해당 권한 있을 때만 노출

### 3.3 이벤트 템플릿 (`/events`)
- **목록/상세 조회**: event_template.view → 관리자, GM, 기획자
- **추가/수정/삭제**: event_template.create / edit / delete → 버튼은 해당 권한 있을 때만 노출

### 3.4 DB 접속 정보 (`/db-connections`)
- **목록**: db_connection.view 또는 db.manage
- **추가/수정/삭제/연결 테스트**: 각각 db_connection.create / edit / delete / test (또는 db.manage). 권한 없으면 해당 버튼 비노출·API 403.

### 3.5 사용자 (`/users`)
- **목록**: user.view. **추가/수정/삭제/비밀번호 초기화**: user.create / edit / delete / reset_password → 버튼은 해당 권한 있을 때만 노출.

### 3.6 역할 권한 (`/roles`)
- **목록**: role.view. **추가/수정/삭제/권한 수정**: role.create / edit / delete / edit_permissions → 버튼은 해당 권한 있을 때만 노출.

### 3.7 나의 대시보드 (`/my-dashboard`) — 상태별 액션

| 인스턴스 상태 | 표시/액션 | 테스트할 역할 |
|---------------|-----------|----------------|
| event_created | 수정, 컨펌 요청 | **GM**, **기획자**, 관리자 (my_dashboard.edit, my_dashboard.request_confirm) |
| confirm_requested | DBA 컨펌 | **DBA**, 관리자 |
| dba_confirmed | QA 요청 / LIVE 요청 | **GM**, 관리자 (approve_qa / approve_live) |
| qa_requested | QA DB 실행 | **DBA**, 관리자 |
| qa_deployed | QA 확인 | **GM**, 관리자 |
| qa_verified | (다음 단계로) | **GM**, 관리자 |
| live_requested | LIVE DB 실행 | **DBA**, 관리자 |
| live_deployed | LIVE 확인 | **GM**, 관리자 |
| live_verified | LIVE 반영 완료(승인) | **GM**, 관리자 (approve_live) |

- **기획자**는 approve/verify 권한이 없어, QA·LIVE 요청/확인/승인 버튼은 **안 보이는 것이 정상**입니다.  
  → “이벤트 생성 + 나의 대시보드 목록·상세 + event_created 수정/삭제”만 기획자로 테스트하면 됩니다.

### 3.8 이벤트 생성 (`/query`)
- **페이지 접근**: instance.view 또는 instance.create → 관리자, **GM**, **기획자**
- **제출(생성) 버튼**: instance.create 있을 때만 노출. 보기만 있으면 페이지는 보이지만 생성 불가.

---

## 4. 테스트 시나리오 요약

1. **관리자**  
   - 모든 메뉴 진입, 대시보드/프로덕트/이벤트/DB/사용자/역할 CRUD, 나의 대시보드·이벤트 생성, 나의 대시보드의 모든 상태·버튼(컨펌/실행/확인/승인) 테스트.
2. **DBA**  
   - 나의 대시보드만 메뉴 노출 확인, DBA 컨펌 / QA 실행 / LIVE 실행 버튼만 테스트.
3. **GM**  
   - 프로덕트·이벤트 조회, 나의 대시보드, 이벤트 생성, event_created 수정/삭제, QA·LIVE 요청/확인/승인 등 GM 권한 버튼 전부 테스트.
4. **기획자**  
   - 프로덕트·이벤트 조회, 나의 대시보드, 이벤트 생성, event_created 수정/삭제만 테스트.  
   - QA/LIVE 요청·확인·승인 버튼이 **안 보이는지** 확인하면 “최소 권한” 동작 검증 완료.

---

## 5. 테스트 계정 (시드 기준)

- **admin** / (비밀번호) → 관리자  
- **gm01** / (비밀번호) → GM  
- **dba01** / (비밀번호) → DBA  
- 기획자: 사용자 관리에서 **기획자(game_designer)** 역할을 부여한 계정으로 로그인해 테스트.

위 네 가지 역할로 **모든 메뉴, 모든 페이지, 모든 권한 구간의 버튼**을 커버할 수 있습니다.

---

## 6. 자동화 테스트 실행 방법 (사용자별·역할별 권한 API 테스트)

백엔드에서 **역할/권한에 따른 API 접근(200 vs 403)**을 자동으로 검증하는 테스트가 있습니다. 아래처럼 실행하면 됩니다.

### 전체 API 테스트 (권한 포함)

```bash
cd backend
npm test
```

또는 API 테스트 파일만 실행:

```bash
cd backend
npm run test:api
```

### 권한·역할 관련 테스트만 실행

사용자별/역할별 권한, 메뉴·페이지 대응 API만 돌리려면:

```bash
cd backend
npm run test:permission
```

이렇게 하면 다음 항목들이 실행됩니다.

- **인증 — 로그인**: admin / GM / DBA 로그인, 토큰·arrRoles·arrPermissions
- **권한별 API (GM 토큰)**: products/events 200, users 403
- **권한별 API (DBA 토큰)**: event-instances 200
- **권한별 API — 프로덕트/이벤트 템플릿/DB 접속/사용자·역할**: view 있으면 200, 없으면 403
- **역할·권한별 메뉴/페이지/기능 접근 (API 매트릭스)**: admin 전부 200, GM/DBA는 허용된 API만 200·나머지 403
- **권한 추가/삭제 시나리오**: 권한 제거 후 403, 복원 후 재로그인 시 200

### Jest로 특정 describe만 실행 (선택)

특정 describe 블록 이름으로만 실행할 때:

```bash
cd backend
npx jest --runInBand --testPathPattern=api.test --testNamePattern="역할·권한별 메뉴"
```

| 실행 목적           | 명령어 |
|--------------------|--------|
| 전체 테스트         | `npm test` |
| API 테스트만       | `npm run test:api` |
| 권한/역할 테스트만 | `npm run test:permission` |
| 메뉴 매트릭스만     | `npx jest --runInBand --testPathPattern=api.test --testNamePattern="역할·권한별 메뉴"` |
