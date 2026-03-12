# 이벤트 로그 / 사용자 로그 화면 검토

> 이벤트 로그 구조 분석 및 구현 방안 정리 (2026-03-10)

---

## 1. 현재 이벤트 로그 구조

### 1.1 데이터 위치

- **인스턴스 단위 저장**: 각 이벤트 인스턴스(`IEventInstance`) 안에 `arrStatusLogs: IStatusLog[]` 로 보관.
- **저장소**: `backend/src/data/eventInstances.ts` → `eventInstances.json` (또는 메모리).
- **전역 로그 테이블 없음**: "모든 인스턴스의 상태 변경 이력을 한 화면에서 보는" 전용 데이터는 없음.

### 1.2 IStatusLog 필드 (backend/data/eventInstances.ts, front/types/index.ts)

| 필드 | 타입 | 설명 |
|------|------|------|
| `strStatus` | TEventStatus | 변경된 상태 (event_created, qa_deployed, …) |
| `strChangedBy` | string | 처리자 표시 이름 |
| `nChangedByUserId` | number | 처리자 사용자 ID |
| `strComment` | string | 코멘트 (예: "이벤트 생성", "QA 반영 완료 - 3건 처리", "DBA 쿼리 직접 수정") |
| `dtChangedAt` | string | 변경 시각 (ISO 8601) |
| `objExecutionResult?` | object | qa_deployed / live_deployed 시에만: strEnv, nTotalAffectedRows, nElapsedMs, arrQueryResults |

### 1.3 로그가 기록되는 시점 (백엔드)

| 시점 | 위치 | 내용 |
|------|------|------|
| 인스턴스 생성 | `fnCreateInstance` | 1건 추가 (strStatus: event_created, strComment: "이벤트 생성") |
| 상태 변경 | `fnChangeStatus` (PATCH .../status) | 1건 추가 (다음 상태 + 코멘트) |
| QA/LIVE 실행 | `fnExecuteAndDeploy` (POST .../execute) | 1건 추가 + objExecutionResult (건수, 소요시간, 쿼리별 결과) |
| DBA 쿼리 수정 | `fnUpdateInstance` (요청 대기 단계에서 strGeneratedQuery 수정 시) | 1건 추가 (strComment: "DBA 쿼리 직접 수정") |

---

## 2. 이벤트 로그 화면 — 구현 방안

### 2.1 목표

- **이벤트 로그 화면**: "누가, 언제, 어떤 이벤트(인스턴스)에서, 어떤 상태로 변경했는지"를 한 목록(테이블)으로 조회.

### 2.2 방안 A: 백엔드 평탄화 API (권장)

- **API**: `GET /api/event-logs` (또는 `GET /api/event-instances/logs`).
  - 쿼리: `from`, `to` (기간), `nUserId` (처리자), `strStatus`, `nInstanceId` 등 선택 필터.
- **로직**: 서버에서 `arrEventInstances` 순회 → 각 인스턴스의 `arrStatusLogs`를 1건씩 꺼내서  
  `{ nInstanceId, strEventName, strProductName, ... }` + `IStatusLog` 필드로 평탄화한 배열 반환.
- **정렬**: `dtChangedAt` 내림차순 기본.
- **장점**: 프론트는 단순 목록 API만 호출하면 됨. 페이징/필터를 서버에서 일관되게 처리 가능.
- **단점**: 인스턴스/로그가 매우 많으면 성능 이슈 가능 → 나중에 DB 전환 시 인덱스/별도 로그 테이블로 분리 검토.

### 2.3 방안 B: 프론트에서만 평탄화

- **API**: 기존 `GET /api/event-instances` 사용 (필터 옵션 확장 가능).
- **로직**: 프론트에서 응답 배열을 순회하며 `arrStatusLogs`를 flatten하고, 인스턴스 정보(nId, strEventName 등)를 각 로그 항목에 붙여서 테이블 데이터로 사용.
- **장점**: 백엔드 변경 최소.
- **단점**: 인스턴스 수가 많으면 응답 크기·클라이언트 연산이 커짐. "로그만 보고 싶은" 조회에 인스턴스 전체를 매번 가져와야 함.

### 2.4 방안 C: 전역 로그 저장소 신규 추가

- **저장소**: `backend/src/data/eventLogs.ts` + `eventLogs.json` (또는 메모리 배열).
- **로직**: 상태 변경/실행/쿼리 수정 시 `eventInstanceController` 등에서 기존처럼 `arrStatusLogs.push` 한 뒤, **추가로** 전역 `arrEventLogs`에 `{ nInstanceId, strEventName, ... }` + IStatusLog 형태로 1건 push.
- **API**: `GET /api/event-logs` 는 이 배열을 조회/필터/페이징.
- **장점**: 로그 전용 뷰에 최적화, 기간/사용자별 조회가 단순.
- **단점**: 데이터 이중 저장, 생성/수정 코드 두 군데 수정 필요. 동기화 누락 시 불일치 가능.

---

## 3. 이벤트 로그 화면에서 할 일 (검토 체크리스트)

- [ ] **API 결정**: A(평탄화 API) / B(프론트 평탄화) / C(전역 로그) 중 선택.
- [ ] **API 스펙**:  
  - 경로: `GET /api/event-logs` (또는 기존 경로에 쿼리 추가).  
  - 쿼리: `from`, `to`, `nUserId`, `strStatus`, `nInstanceId`, `page`, `pageSize`.  
  - 응답: `{ arrLogs: IEventLogEntry[], nTotal: number }` 형태 등.
- [ ] **프론트**  
  - 페이지: 예) `EventLogPage.tsx`, 라우트 `/event-logs` (또는 운영 메뉴 하위).  
  - 테이블 컬럼: 일시, 처리자, 이벤트명(인스턴스), 프로덕트, 상태, 코멘트, (실행 시) 환경/건수/소요시간.  
  - 필터: 기간, 처리자, 상태, 인스턴스 ID/이름.  
  - 권한: 관리자만 또는 특정 권한(예: `instance.view` 등)으로 제한할지 결정.
- [ ] **기존 대시보드와 관계**: 나의 대시보드는 "인스턴스 단위" 보기, 이벤트 로그는 "로그 단위" 보기로 구분.

---

## 4. 사용자 로그 — 현재 상태 및 방향

### 4.1 현재 상태

- **로그인/로그아웃**: `authController`에서 JWT 발급·검증만 수행. "로그인 시도(성공/실패)·로그아웃" 기록 저장 없음.
- **사용자 관리**: 사용자 CRUD, 비밀번호 초기화, 권한 수정 등 API는 있으나, "누가 언제 무엇을 변경했는지" 감사 로그는 없음.

### 4.2 사용자 로그 화면에 넣을 수 있는 것 (검토)

- 로그인 시도 (성공/실패, 시각, IP·User-Agent는 선택).
- 로그아웃 시각.
- 비밀번호 초기화 (대상 사용자, 실행자, 시각).
- 권한 변경 (대상, 변경 내용, 실행자, 시각).
- 사용자 생성/수정/삭제 (누가, 언제, 어떤 필드 변경).

이를 위해 **사용자 활동 로그 저장소** (예: `userLogs.ts` / `user_logs` 테이블)와  
로그인·로그아웃·사용자 API에서 "한 건씩 기록"하는 로직이 필요.

---

## 5. 다음 단계 제안

1. **이벤트 로그**  
   - 방안 A/B/C 중 하나 확정 후,  
   - 백엔드 API(또는 기존 API 확장) → 프론트 `EventLogPage` (테이블 + 필터 + 권한) 순으로 구현.
2. **사용자 로그**  
   - 저장할 이벤트 종류(로그인 성공/실패, 로그아웃, 비밀번호 초기화, 권한/사용자 변경 등) 범위 확정 후,  
   - 저장소 구조 + 기록 지점 추가 → `GET /api/user-logs` (또는 유사) + `UserLogPage` 구현.

이 문서를 바탕으로 "이벤트 로그부터 구현할지", "API를 A로 할지 B/C로 할지" 등만 정하면 바로 설계·코드로 이어갈 수 있습니다.
