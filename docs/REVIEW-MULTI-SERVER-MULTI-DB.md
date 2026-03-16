# 검토: 단일 서버/DB vs 다중 서버·다중 DB 구조

> 작성일: 2026-03-10  
> 목적: 현재는 **하나의 서버, 하나의 DB**에서만 쿼리가 실행되는 구조를, **다중 서버·다중 DB** 실행이 가능하도록 개선할 때의 비교·검토

---

## 1. 현재 구조 요약 (단일 서버·단일 DB)

### 1.1 데이터 모델

| 계층 | 현재 구조 | 실행 시 동작 |
|------|-----------|----------------|
| **이벤트 템플릿** | `strQueryTemplate` 1개 + `strDefaultItems` 1개 | QA/LIVE 구분 없음. 프로덕트당 “한 연결” 전제 |
| **DB 접속** | (nProductId, strEnv) 당 **활성 1건** 사용 (`fnFindActiveConnection`) | 동일 프로덕트·동일 env면 서버 1대만 |
| **이벤트 인스턴스** | `nProductId` 1개, `strGeneratedQuery` 1개 | 실행 시 “해당 프로덕트 + 요청 env” 접속 1개로 위 쿼리만 실행 |
| **실행 API** | `POST .../execute` body: `{ strEnv: 'qa' \| 'live' }` | 접속 1개 조회 → `strGeneratedQuery` 한 번 실행 |

### 1.2 실행 흐름 (한 번의 Execute)

```
요청: strEnv = 'qa' (또는 'live')
  → 인스턴스.nProductId 로 프로덕트 확정
  → fnFindActiveConnection(nProductId, strEnv) → DB 접속 정보 1건
  → fnExecuteQueryWithText(objConn, strGeneratedQuery, strEnv)
     → 같은 연결 위에서 fnParseQueries(세미콜론 분리) 후 문장별 실행·트랜잭션
  → 전부 성공 시에만 상태 전이 (qa_deployed / live_deployed)
```

- **한 이벤트 = 한 프로덕트 = 한 env당 접속 1개 = 쿼리 문자열 1개**(내부적으로 여러 문장 가능).
- **여러 서버 / 여러 DB**에 나눠 실행하는 구조는 아님.

### 1.3 지원 범위

| 시나리오 | 현재 지원 |
|----------|-----------|
| 한 서버·한 DB에 **여러 문장** (세미콜론 분리) | ✅ 지원 |
| **여러 서버**에 각각 다른 쿼리 실행 | ❌ 미지원 |
| **여러 DB**(다른 호스트/포트/DB명)에 각각 쿼리 실행 | ❌ 미지원 |
| 같은 프로덕트 내 **GAME / WEB / LOG** 등 종류별 다른 접속에 동시 실행 | ❌ 미지원 (실행 시 종류 구분 없이 1건만 사용) |

---

## 2. 요구 시나리오: 다중 서버·다중 DB

예시:

- **서버 A** (게임 DB): `UPDATE item ...`, `INSERT INTO event_log ...`
- **서버 B** (다른 리전/샤드 게임 DB): 동일 이벤트용 `UPDATE ...`
- **서버 C** (로그 DB): `INSERT INTO audit_log ...`

또는:

- 같은 프로덕트라도 **GAME DB / WEB DB / LOG DB** 각각에 서로 다른 쿼리를 실행해야 하는 경우.

공통점: **실행 대상이 “접속(서버/DB)별로 여러 개”이고, 접속마다 “실행할 쿼리”가 다를 수 있음.**

---

## 3. 현재 구조 vs 개선 구조 비교

### 3.1 이벤트 템플릿

| 항목 | 현재 (단일) | 개선 (다중 서버/DB) |
|------|-------------|----------------------|
| 쿼리 정의 | `strQueryTemplate` 1개 | **세트 배열** `arrQueryTemplates[]`: 세트당 **(연결 식별) + 쿼리 템플릿** |
| 연결 지정 | 없음 (실행 시 프로덕트+env로 1건 자동 선택) | 세트당 **nDbConnectionId** 또는 (nProductId, strEnv, strKind 등)로 “어느 DB에 이 쿼리를 쓸지” 명시 |
| 입력값 | `strInputValues` 1개 → 하나의 템플릿에만 치환 | 동일 1개 `strInputValues` → **각 세트의 strQueryTemplate에 공통 치환** ({{items}}, {{date}} 등) |
| 기본값 | `strDefaultItems` 1개 | 공통 1개 유지 + 세트별 `strDefaultItems`(선택, 힌트/예시용) |

이미 **백엔드·프론트 타입**에 `arrQueryTemplates`(IQueryTemplateItem), `IQueryTemplateItem.nDbConnectionId` 가 정의되어 있음.  
현재는 “단일만 사용”하도록 롤백된 상태이므로, **다중 지원 시 이 필드를 다시 사용**하면 됨.

### 3.2 이벤트 인스턴스

| 항목 | 현재 (단일) | 개선 (다중 서버/DB) |
|------|-------------|----------------------|
| 실행할 쿼리 | `strGeneratedQuery` 1개 | **단일 모드**: `strGeneratedQuery` 1개 (기존과 동일) **세트 모드**: `arrExecutionTargets[]` — 요소당 `{ nDbConnectionId, strQuery }` |
| 프로덕트 | `nProductId` 1개 (연결 조회용) | 유지. 단일 모드 fallback 시 사용. 세트 모드에서는 각 target이 이미 연결 ID를 가짐 |

이미 **IExecutionTarget**, **arrExecutionTargets** 가 정의되어 있음.  
실행 로직만 “arrExecutionTargets 있으면 env별로 필터 후 순회 실행”으로 확장하면 됨.

### 3.3 DB 접속 정보

| 항목 | 현재 | 개선 |
|------|------|------|
| 조회 방식 | `fnFindActiveConnection(nProductId, strEnv)` → 1건 | **단일**: 동일. **다중**: `arrExecutionTargets`의 `nDbConnectionId`로 `fnFindConnectionById(nId)` 사용 → **접속별로 서로 다른 서버/DB** 가능 |
| (nProductId, strEnv) 당 개수 | 사실상 1건만 사용 | **이미 여러 건 가능** (GAME/WEB/LOG 등 strKind별로 여러 접속 등록 가능). 다중 실행 시 “어떤 접속들을 쓸지”는 템플릿 세트가 nDbConnectionId로 지정 |

즉, **접속 정보 모델은 확장 없이** “여러 접속을 등록해 두고, 실행 대상만 배열로 지정”하면 됨.

### 3.4 실행 API 및 로직

| 항목 | 현재 | 개선 |
|------|------|------|
| 요청 | `POST .../execute` body: `{ strEnv }` | 동일. env는 “QA 실행” vs “LIVE 실행” 구분용 |
| 실행 단위 | 접속 1개 + `strGeneratedQuery` 1개 | **arrExecutionTargets 있음**: 요청 env와 **같은 strEnv**인 연결만 필터 → 순서대로 각 (nDbConnectionId, strQuery) 실행. **없음**: 기존처럼 nProductId + strGeneratedQuery 1건 |
| 성공/실패 | 한 번 실행, 실패 시 상태 전이 없음 | **다중**: “전부 성공 시에만” 상태 전이. 중간에 한 건이라도 실패하면 중단, 이미 실행된 DB는 롤백 불가(서버별 트랜잭션만 적용) → 실패 시 사용자에게 “N번째 대상까지 실행됨, O 서버 실패” 등 메시지 |
| 실행 결과 저장 | arrStatusLogs에 objExecutionResult 1건 | **다중**: env별로 **target별 결과**를 배열로 저장 (어느 연결에서 몇 건 처리 등) |

### 3.5 쿼리 실행기 (queryExecutor)

| 항목 | 현재 | 개선 |
|------|------|------|
| 진입점 | `fnExecuteQueryWithText(objConn, strGeneratedQuery, strEnv)` | **그대로 사용**. 다중일 때는 **컨트롤러**에서 arrExecutionTargets를 순회하며, target마다 fnFindConnectionById → fnExecuteQueryWithText 호출 |
| 단일 연결 내 | 세미콜론 분리 멀티 문장 + 트랜잭션 | 변경 없음 |

실행기 자체는 “한 연결 + 한 쿼리 문자열” 시그니처 유지. 다중은 **호출 횟수**만 늘어남.

---

## 4. 개선 시 권장 구조 (요약)

### 4.1 템플릿

- **단일 모드 (기존)**  
  - `strQueryTemplate` + `strDefaultItems`  
  - `arrQueryTemplates` 없거나 비어 있음.
- **세트 모드 (다중 서버/DB)**  
  - `arrQueryTemplates` 1개 이상.  
  - 각 세트: `nDbConnectionId`(필수), `strQueryTemplate`, `strDefaultItems`(선택).  
  - 이벤트 생성 시 `strInputValues` 1개로 모든 세트의 `strQueryTemplate`에 치환 → **인스턴스에** `arrExecutionTargets` 생성 (세트당 `{ nDbConnectionId, strQuery }`).

### 4.2 인스턴스

- **단일**: `strGeneratedQuery`만 사용. `arrExecutionTargets` 없음.  
- **세트**: `arrExecutionTargets` 사용. `strGeneratedQuery`는 비우거나 “요약/미리보기”용으로만 사용 가능.

### 4.3 실행 (Execute)

1. **arrExecutionTargets 있음 && 길이 > 0**  
   - 요청 `strEnv`와 **같은 env**인 DB 연결만 필터 (nDbConnectionId → fnFindConnectionById → connection.strEnv === strEnv).  
   - 필터된 target을 **순차** 실행 (병렬도 정책에 따라 가능).  
   - 전부 성공 시에만 상태 전이; 하나라도 실패 시 중단, 실패 메시지 반환, 상태는 그대로.
2. **arrExecutionTargets 없음**  
   - 기존처럼 `fnFindActiveConnection(nProductId, strEnv)` + `strGeneratedQuery` 1회 실행 (하위 호환).

### 4.4 DB 접속 정보

- **추가 스키마 변경 없이** 현재 구조로 다중 서버/DB 지원 가능.  
- 같은 프로덕트라도 “서버별/DB별”로 접속을 여러 건 등록해 두고, 템플릿 세트에서 `nDbConnectionId`로 선택.

### 4.5 UI 관점

- **이벤트 템플릿 편집**:  
  - 단일(현재) / 세트 모드 선택.  
  - 세트 모드일 때 “DB 연결 선택 + 쿼리 템플릿 + (선택) 기본값”을 리스트로 추가·수정·삭제.
- **이벤트(인스턴스) 생성**:  
  - 입력값 1개. 세트 모드면 각 세트 쿼리에 동일 적용 → 생성 시 백엔드에서 `arrExecutionTargets` 생성.
- **나의 대시보드 / 실행**:  
  - “이번 실행에서 몇 개 서버(대상)에 쿼리할지” 표시.  
  - 실행 결과는 “대상별 성공/실패·영향 행 수” 등으로 표시 가능.

---

## 5. 현재 vs 개선 비교표 (한눈에)

| 구분 | 현재 (단일 서버·단일 DB) | 개선 (다중 서버·다중 DB) |
|------|---------------------------|----------------------------|
| **템플릿** | strQueryTemplate 1개 | arrQueryTemplates[] (세트당 nDbConnectionId + strQueryTemplate) |
| **인스턴스** | strGeneratedQuery 1개 | strGeneratedQuery(단일) 또는 arrExecutionTargets[](세트) |
| **연결 결정** | nProductId + strEnv → 1건 | nDbConnectionId로 접속 직접 지정 → 서버/DB 여러 개 가능 |
| **실행** | 접속 1개에 쿼리 1번 | 접속 N개에 각각 해당 strQuery 1번 (전부 성공 시에만 완료) |
| **호환** | - | arrExecutionTargets 없으면 기존 단일 로직 그대로 사용 |

이미 `IQueryTemplateItem`, `IExecutionTarget`, `arrQueryTemplates`, `arrExecutionTargets` 타입·필드가 있으므로, **실행 분기 복원 + 템플릿/인스턴스 생성 시 세트 처리**만 추가하면 다중 서버·다중 DB 구조로 확장할 수 있습니다.
