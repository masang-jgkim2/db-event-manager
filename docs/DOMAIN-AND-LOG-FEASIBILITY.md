# 프로덕트·이벤트·DB·사용자·역할 구조 분석 및 로그 가능 여부

> 요청하신 “로그로 볼 수 있는 것들”이 현재 구조로 가능한지 검토 (2026-03-10)

---

## 1. 엔티티 관계도 (현재 구조)

```
[Product] 1 ────┬── * [EventTemplate]   (nProductId)
  │             │
  │             └── * [EventInstance]    (nEventTemplateId, nProductId)
  │
  └── * [DbConnection]  (nProductId, strEnv: dev/qa/live)

[User] 1 ───────────── * [EventInstance]  (nCreatedByUserId, objCreator, objConfirmer, ...)
  │
  └── arrRoles: string[]  ──── 참조 ──── * [Role] (strCode)

[EventInstance]
  - nEventTemplateId → EventTemplate
  - nProductId       → Product
  - nCreatedByUserId → User
  - arrStatusLogs[]  → 상태 변경·실행 이력 (인스턴스 단위만 저장)
```

- **Product**: EventTemplate, EventInstance, DbConnection이 nProductId로 참조. Product 자체에는 생성/수정/삭제 이력 없음.
- **EventTemplate**: EventInstance가 nEventTemplateId로 참조. 템플릿에는 dtCreatedAt만 있고 변경 이력 없음.
- **DbConnection**: Product별·환경별 1개. dtCreatedAt, dtUpdatedAt만 있고 “누가/무엇을 변경” 로그 없음. 연결 테스트 결과 저장 없음.
- **User**: EventInstance의 생성자·처리자로 참조. 사용자 CRUD/로그인·로그아웃 이력 없음.
- **Role**: users.arrRoles가 역할 코드 문자열 배열. roles.json에 CRUD 있으나 역할 변경 이력 없음.

---

## 2. 엔티티별 “원하는 로그” vs “현재 가능 여부”

### 2.1 프로덕트 (Product)

| 원하는 것 | 현재 구조로 가능? | 비고 |
|-----------|-------------------|------|
| 생성 로그 | ❌ 불가 | 생성 시 별도 감사 저장 없음. 현재 데이터로는 “언제 생겼는지”만 dtCreatedAt으로 추정 가능. |
| 삭제 로그 | ❌ 불가 | 삭제 시 누가/언제 삭제했는지 기록 없음. |
| 수정 로그 | ❌ 불가 | 수정 시 이전 값/변경자/시각 기록 없음. |
| 선택된 프로덕트에서 진행 중인 이벤트 | ✅ 가능 | EventInstance 목록에서 nProductId + strStatus가 완료(live_verified)가 아닌 것 필터. |
| 해당 프로덕트에서 이벤트를 생성한 사용자 로그 | ✅ 가능 | EventInstance에서 nProductId 일치하는 것의 objCreator / nCreatedByUserId로 집계 가능. |

**요약**: CRUD 감사 로그는 전부 없음. “진행 중 이벤트”와 “이벤트 생성한 사용자”는 인스턴스 데이터로 조회·집계 가능.

---

### 2.2 쿼리 템플릿 (Event / EventTemplate)

| 원하는 것 | 현재 구조로 가능? | 비고 |
|-----------|-------------------|------|
| 생성 로그 | ❌ 불가 | 생성/수정/삭제 감사 없음. dtCreatedAt만 있음. |
| 삭제 로그 | ❌ 불가 | |
| 수정 로그 | ❌ 불가 | |
| 선택된 쿼리 템플릿 기준 진행 중 인스턴스 | ✅ 가능 | EventInstance에서 nEventTemplateId + strStatus ≠ live_verified 필터. |
| 선택된 쿼리 템플릿 기준 완료 인스턴스 | ✅ 가능 | nEventTemplateId + strStatus === 'live_verified'. |
| 쿼리 템플릿별 인스턴스를 가장 많이 생성한 사용자 수 등 | ✅ 가능 | EventInstance에서 nEventTemplateId로 필터 후 nCreatedByUserId/objCreator 기준 집계. |

**요약**: 템플릿 CRUD 로그는 없음. “진행 중/완료 인스턴스”, “가장 많이 한 사용자”는 인스턴스 데이터로 가능.

---

### 2.3 DB 접속 정보 (DbConnection)

| 원하는 것 | 현재 구조로 가능? | 비고 |
|-----------|-------------------|------|
| 생성 로그 | ❌ 불가 | 별도 감사 저장 없음. dtCreatedAt만 있음. |
| 삭제 로그 | ❌ 불가 | |
| 수정 로그 | ❌ 불가 | dtUpdatedAt만 갱신, “누가/무엇을” 없음. |
| 최근 접속 테스트 로그 | ❌ 불가 | fnTestConnection 은 결과만 응답으로 반환, DB/파일에 저장 안 함. |
| 실행된 쿼리 (프로덕트·이벤트·사용자 등) | ⚠️ 부분 가능 | **성공한** 실행만 인스턴스별 arrStatusLogs 안의 objExecutionResult에 저장됨. 전역 “쿼리 실행 로그” 테이블은 없음. |
| 실패한 쿼리 | ❌ 불가 | 실행 실패 시 arrStatusLogs에 넣지 않음. 클라이언트에만 결과 반환. |
| 성공한 쿼리 | ⚠️ 부분 가능 | 위와 동일. 인스턴스·상태 로그 안에만 있음. |

**요약**: DB 접속 CRUD/연결 테스트 로그 없음. “실행된/성공/실패 쿼리”를 한곳에서 보려면 전역 쿼리 실행 로그 저장이 필요.

---

### 2.4 사용자 (User)

| 원하는 것 | 현재 구조로 가능? | 비고 |
|-----------|-------------------|------|
| 생성 로그 | ❌ 불가 | |
| 삭제 로그 | ❌ 불가 | |
| 수정 로그 | ❌ 불가 | dtCreatedAt만 있음. |
| 로그인 | ❌ 불가 | authController에서 JWT만 발급, 시도(성공/실패) 기록 없음. |
| 로그아웃 | ❌ 불가 | 서버에 로그아웃 이벤트 없음. |
| 사용자 클릭 시 최근 행위 로그 | ⚠️ 부분 가능 | EventInstance의 arrStatusLogs + objCreator/objConfirmer 등에서 nUserId로 필터하면 “이 사용자가 관여한 상태 변경·실행”만 모을 수 있음. “로그인/CRUD” 같은 행위는 없음. |

**요약**: 사용자 CRUD·로그인/로그아웃 로그 전부 없음. “이벤트 인스턴스 상의 행위”(생성/상태 변경/실행)만 인스턴스 데이터로 추적 가능.

---

### 2.5 역할 구조 (Role)

| 원하는 것 | 현재 구조로 가능? | 비고 |
|-----------|-------------------|------|
| 생성/삭제/수정 로그 | ❌ 불가 | roles.json CRUD만 있고, 누가/언제/무엇을 변경했는지 저장 없음. |
| 사용자별 역할 변경 이력 | ❌ 불가 | User에 arrRoles 현재값만 있음. 과거 역할 이력 없음. |

**요약**: 역할·권한 변경 감사는 현재 구조로 불가.

---

## 3. 현재 구조로 “가능한” 로그/통계 정리

- **이벤트 인스턴스**
  - 상태 변경 이력: 인스턴스별 `arrStatusLogs` (생성, 상태 전이, QA/LIVE 실행 성공, DBA 쿼리 수정).
  - 진행 중/완료 구분: `strStatus` 기준.
- **프로덕트 기준**
  - 진행 중 인스턴스: `nProductId` + `strStatus !== 'live_verified'`.
  - 해당 프로덕트에서 이벤트 생성한 사용자: 인스턴스의 `objCreator`/`nCreatedByUserId` 집계.
- **쿼리 템플릿 기준**
  - 진행 중/완료 인스턴스: `nEventTemplateId` + `strStatus` 필터.
  - 템플릿별 “가장 많이 한 사용자” 등: `nCreatedByUserId` 집계.
- **사용자 기준**
  - “최근 행위”: `arrStatusLogs`의 `nChangedByUserId` + 단계별 처리자(objCreator 등)로 해당 사용자 관여 건만 조회 (이벤트 인스턴스 도메인 안에서만).

---

## 4. “불가”인 것 — 추가로 필요한 저장소/로깅

아래를 하려면 **새 감사(로그) 저장소 + 기록 지점**이 필요합니다.

| 대상 | 추가 시 필요한 것 |
|------|-------------------|
| 프로덕트 | 생성/수정/삭제 시 “누가, 언제, 무엇을(이전값→새값)” 기록하는 테이블/배열 + API. |
| 쿼리 템플릿 | 위와 동일한 형태의 CRUD 감사 로그. |
| DB 접속 정보 | CRUD 감사 로그 + “연결 테스트” 시도/성공/실패·시각·연결 ID (선택: 사용자) 저장. |
| 쿼리 실행 (전역) | 실행 시마다 1건 저장: 프로덕트/인스턴스/사용자/환경/성공·실패/쿼리/에러메시지/시각. (기존 arrStatusLogs는 “성공 시 인스턴스 안”에만 있음.) |
| 사용자 | 로그인 성공·실패, 로그아웃 시각 저장. 사용자 CRUD(생성/수정/삭제/비밀번호 초기화/권한 변경) 시 “누가, 대상 누구, 무엇을” 기록. |
| 역할 | 역할 CRUD 및 “사용자 역할 변경” 시 변경 이력 저장. |

---

## 5. 결론

- **지금 구조만으로 가능한 것**
  - 프로덕트: 선택 프로덕트의 **진행 중 이벤트**, **이벤트 생성한 사용자** (인스턴스 기반).
  - 이벤트: **진행 중/완료 인스턴스**, **가장 많이 한 사용자** 등 (인스턴스 기반).
  - DB: **성공한 쿼리**는 인스턴스의 `arrStatusLogs` 안에서만 조회 가능 (전역 “DB 로그” 화면은 불가).
  - 사용자: **이벤트 인스턴스 상의 행위**(생성/상태 변경/실행)만 인스턴스·arrStatusLogs로 추적 가능.
- **현재 구조로 불가능한 것**
  - 프로덕트/쿼리 템플릿/DB(접속 정보)/사용자/역할에 대한 **CRUD 감사 로그** 전부.
  - **로그인/로그아웃**, **연결 테스트 로그**, **실패한 쿼리 저장**, **전역 쿼리 실행 로그**.

원하시는 “로그로 다 보여 주기”를 하려면,  
- **공통**: 감사 로그용 엔티티(또는 테이블) 설계 (예: `audit_logs` 또는 엔티티별 `product_logs`, `user_logs` 등),  
- **기록 지점**: 각 Controller의 create/update/delete + 로그인/로그아웃/연결 테스트/쿼리 실행 시 1건씩 insert  
를 추가하는 방향이 필요합니다.  
다음 단계로 “감사 로그 스키마(엔티티 구조) 초안”을 잡을 수 있습니다.
