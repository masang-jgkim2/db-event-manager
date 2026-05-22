# 검토: 단일 서버/DB vs 다중 서버·다중 DB 구조

> 작성일: 2026-03-10  
> 목적: 현재는 **하나의 서버, 하나의 DB**에서만 쿼리가 실행되는 구조를, **다중 서버·다중 DB** 실행이 가능하도록 개선할 때의 비교·검토

---

## 1. 현재 구조 요약 (단일 서버·단일 DB)

### 1.1 데이터 모델

| 계층 | 현재 구조 | 실행 시 동작 |
|------|-----------|----------------|
| **쿼리 템플릿** | `strQueryTemplate` 1개 + `strDefaultItems` 1개 | QA/LIVE 구분 없음. 프로덕트당 “한 연결” 전제 |
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

## 2. QA / LIVE 반영 구조 (공통)

단일 서버이든 다중 서버이든, **반영은 항상 “QA 반영”과 “LIVE 반영”으로 구분**된다.

### 2.1 인스턴스 반영 범위: arrDeployScope

- **인스턴스**에는 `arrDeployScope: Array<'qa' | 'live'>` 가 있음.
- 의미: “이 이벤트를 **어느 환경에** 반영할지” (QA만 / LIVE만 / QA+LIVE).
- Execute API 호출 시, 요청한 `strEnv`가 이 배열에 포함되어 있어야 실행 허용 (그렇지 않으면 400 등으로 거부).

### 2.2 실행 API와 env

- **요청**: `POST .../execute` body: `{ strEnv: 'qa' | 'live' }`
  - `strEnv === 'qa'` → **QA 반영 실행** (해당 인스턴스가 `arrDeployScope`에 `'qa'` 포함 시에만 가능).
  - `strEnv === 'live'` → **LIVE 반영 실행** (`'live'` 포함 시에만 가능).
- **DEV** 환경은 Execute API에서 직접 실행 불가(차단). 반영은 QA / LIVE만 존재.

### 2.3 상태와 실행 시점

| 현재 상태       | 실행 가능한 env | 실행 후 상태     |
|----------------|-----------------|------------------|
| `qa_requested` | `qa`            | `qa_deployed`    |
| `live_requested` | `live`        | `live_deployed`  |

- **QA 반영**: 인스턴스가 `qa_requested`일 때만 “QA 쿼리 실행” 가능 → 성공 시 `qa_deployed`.
- **LIVE 반영**: 인스턴스가 `live_requested`일 때만 “LIVE 쿼리 실행” 가능 → 성공 시 `live_deployed`.
- 반영 날짜(`dtDeployDate`)는 **LIVE** 실행 시에만 검사(현재 시각 ≥ 반영 날짜여야 실행 가능). QA는 시간 제한 없음.

### 2.4 “어떤 접속에 실행할지”와 env

- **DB 접속**은 각각 `strEnv: 'dev' | 'qa' | 'live'` 를 가짐.
- **단일 모드**:  
  - QA 실행 → `fnFindActiveConnection(nProductId, 'qa')` 로 **QA 접속 1건** 조회 → 그 접속에 `strGeneratedQuery` 실행.  
  - LIVE 실행 → 동일하게 **LIVE 접속 1건**으로 실행.
- **다중 모드 (개선 후)**  
  - `arrExecutionTargets`에는 서로 다른 접속(nDbConnectionId)이 섞여 있을 수 있음 (일부는 QA용, 일부는 LIVE용).  
  - **QA 반영 실행** 시: `nDbConnectionId`로 조회한 연결 중 **strEnv === 'qa'** 인 target만 필터 → 그 target들만 순차 실행.  
  - **LIVE 반영 실행** 시: **strEnv === 'live'** 인 target만 필터 → 실행.  
- 따라서 **한 번의 Execute 호출**은 “QA 반영 한 번” 또는 “LIVE 반영 한 번”만 수행하며, 그때는 **해당 env의 접속(들)**에만 쿼리가 실행된다.

### 2.5 요약

| 항목 | 설명 |
|------|------|
| **반영 대상 선택** | 인스턴스 `arrDeployScope` → QA만 / LIVE만 / QA+LIVE (UI에서 체크). |
| **실행 요청** | API `strEnv`: `'qa'` = QA 반영, `'live'` = LIVE 반영. |
| **실행 가능 상태** | QA: `qa_requested`, LIVE: `live_requested`. |
| **접속 필터** | 단일: 프로덕트 + strEnv로 1건. 다중: arrExecutionTargets 중 연결의 strEnv가 요청 strEnv와 같은 것만 실행. |

### 2.6 다중 쿼리에서 “연결 DB” = DB 구분 (환경 구분 아님)

- **다중 쿼리 세트**에서 선택하는 **연결 DB**는 **환경(QA/LIVE) 구분이 아니라 DB 구분**이다.
- **DB 구분**:
  - 현재는 DB 접속 생성 시 넣는 **종류**(GAME / WEB / LOG 등)로 구분하는 용도에 가깝다.
  - 차후에는 **접속 정보**(호스트/포트)나 **DB명** 기준으로 구분할 수도 있다.
- **QA / LIVE 반영**은 **이벤트가 생성될 때** 결정된다.
  - 이벤트 생성 시 **쿼리 실행 대상**(arrDeployScope)으로 QA만 / LIVE만 / QA+LIVE 를 선택한다.
  - 실행 시점에는 “QA 반영 실행” / “LIVE 반영 실행”으로 나뉘고, 선택한 대상(들)에만 실행된다.
- **전부는 아니지만**, 일반적으로 **QA 반영 다음 LIVE 반영** 순서로 진행하는 구조이다.
- 정리: 템플릿의 “연결 DB”는 **어떤 DB에 쿼리를 쓸지**(종류·접속·DB명 등)를 정하는 것이고, **어느 환경에 반영할지**(QA/LIVE)는 이벤트 생성·실행 단계에서 정해진다.

---

## 3. 요구 시나리오: 다중 서버·다중 DB

예시:

- **서버 A** (게임 DB): `UPDATE item ...`, `INSERT INTO event_log ...`
- **서버 B** (다른 리전/샤드 게임 DB): 동일 이벤트용 `UPDATE ...`
- **서버 C** (로그 DB): `INSERT INTO audit_log ...`

또는:

- 같은 프로덕트라도 **GAME DB / WEB DB / LOG DB** 각각에 서로 다른 쿼리를 실행해야 하는 경우.

공통점: **실행 대상이 “접속(서버/DB)별로 여러 개”이고, 접속마다 “실행할 쿼리”가 다를 수 있음.**

---

## 4. 현재 구조 vs 개선 구조 비교

### 4.1 쿼리 템플릿

| 항목 | 현재 (단일) | 개선 (다중 서버/DB) |
|------|-------------|----------------------|
| 쿼리 정의 | `strQueryTemplate` 1개 | **세트 배열** `arrQueryTemplates[]`: 세트당 **(연결 식별) + 쿼리 템플릿** |
| 연결 지정 | 없음 (실행 시 프로덕트+env로 1건 자동 선택) | 세트당 **nDbConnectionId** 또는 (nProductId, strEnv, strKind 등)로 “어느 DB에 이 쿼리를 쓸지” 명시 |
| 입력값 | `strInputValues` 1개 → 하나의 템플릿에만 치환 | 동일 1개 `strInputValues` → **각 세트의 strQueryTemplate에 공통 치환** ({{items}}, {{date}} 등) |
| 기본값 | `strDefaultItems` 1개 | 공통 1개 유지 + 세트별 `strDefaultItems`(선택, 힌트/예시용) |

이미 **백엔드·프론트 타입**에 `arrQueryTemplates`(IQueryTemplateItem), `IQueryTemplateItem.nDbConnectionId` 가 정의되어 있음.  
현재는 “단일만 사용”하도록 롤백된 상태이므로, **다중 지원 시 이 필드를 다시 사용**하면 됨.

### 4.2 이벤트 인스턴스

| 항목 | 현재 (단일) | 개선 (다중 서버/DB) |
|------|-------------|----------------------|
| 실행할 쿼리 | `strGeneratedQuery` 1개 | **단일 모드**: `strGeneratedQuery` 1개 (기존과 동일) **세트 모드**: `arrExecutionTargets[]` — 요소당 `{ nDbConnectionId, strQuery }` |
| 프로덕트 | `nProductId` 1개 (연결 조회용) | 유지. 단일 모드 fallback 시 사용. 세트 모드에서는 각 target이 이미 연결 ID를 가짐 |

이미 **IExecutionTarget**, **arrExecutionTargets** 가 정의되어 있음.  
실행 로직만 “arrExecutionTargets 있으면 env별로 필터 후 순회 실행”으로 확장하면 됨.

### 4.3 DB 접속 정보

| 항목 | 현재 | 개선 |
|------|------|------|
| 조회 방식 | `fnFindActiveConnection(nProductId, strEnv)` → 1건 | **단일**: 동일. **다중**: `arrExecutionTargets`의 `nDbConnectionId`로 `fnFindConnectionById(nId)` 사용 → **접속별로 서로 다른 서버/DB** 가능 |
| (nProductId, strEnv) 당 개수 | 사실상 1건만 사용 | **이미 여러 건 가능** (GAME/WEB/LOG 등 strKind별로 여러 접속 등록 가능). 다중 실행 시 “어떤 접속들을 쓸지”는 템플릿 세트가 nDbConnectionId로 지정 |

즉, **접속 정보 모델은 확장 없이** “여러 접속을 등록해 두고, 실행 대상만 배열로 지정”하면 됨.

### 4.4 실행 API 및 로직

| 항목 | 현재 | 개선 |
|------|------|------|
| 요청 | `POST .../execute` body: `{ strEnv }` | 동일. env는 “QA 실행” vs “LIVE 실행” 구분용 |
| 실행 단위 | 접속 1개 + `strGeneratedQuery` 1개 | **arrExecutionTargets 있음**: 요청 env와 **같은 strEnv**인 연결만 필터 → 순서대로 각 (nDbConnectionId, strQuery) 실행. **없음**: 기존처럼 nProductId + strGeneratedQuery 1건 |
| 성공/실패 | 한 번 실행, 실패 시 상태 전이 없음 | **다중**: “전부 성공 시에만” 상태 전이. 중간에 한 건이라도 실패하면 중단, 이미 실행된 DB는 롤백 불가(서버별 트랜잭션만 적용) → 실패 시 사용자에게 “N번째 대상까지 실행됨, O 서버 실패” 등 메시지 |
| 실행 결과 저장 | arrStatusLogs에 objExecutionResult 1건 | **다중**: env별로 **target별 결과**를 배열로 저장 (어느 연결에서 몇 건 처리 등) |

### 4.5 쿼리 실행기 (queryExecutor)

| 항목 | 현재 | 개선 |
|------|------|------|
| 진입점 | `fnExecuteQueryWithText(objConn, strGeneratedQuery, strEnv)` | **그대로 사용**. 다중일 때는 **컨트롤러**에서 arrExecutionTargets를 순회하며, target마다 fnFindConnectionById → fnExecuteQueryWithText 호출 |
| 단일 연결 내 | 세미콜론 분리 멀티 문장 + 트랜잭션 | 변경 없음 |

실행기 자체는 “한 연결 + 한 쿼리 문자열” 시그니처 유지. 다중은 **호출 횟수**만 늘어남.

---

## 5. 개선 시 권장 구조 (요약)

### 5.1 템플릿

- **단일 모드 (기존)**  
  - `strQueryTemplate` + `strDefaultItems`  
  - `arrQueryTemplates` 없거나 비어 있음.
- **세트 모드 (다중 서버/DB)**  
  - `arrQueryTemplates` 1개 이상.  
  - 각 세트: `nDbConnectionId`(필수), `strQueryTemplate`, `strDefaultItems`(선택).  
  - 이벤트 생성 시 `strInputValues` 1개로 모든 세트의 `strQueryTemplate`에 치환 → **인스턴스에** `arrExecutionTargets` 생성 (세트당 `{ nDbConnectionId, strQuery }`).

### 5.2 인스턴스

- **단일**: `strGeneratedQuery`만 사용. `arrExecutionTargets` 없음.  
- **세트**: `arrExecutionTargets` 사용. `strGeneratedQuery`는 비우거나 “요약/미리보기”용으로만 사용 가능.

### 5.3 실행 (Execute)

1. **arrExecutionTargets 있음 && 길이 > 0**  
   - 요청 `strEnv`와 **같은 env**인 DB 연결만 필터 (nDbConnectionId → fnFindConnectionById → connection.strEnv === strEnv).  
   - 필터된 target을 **순차** 실행 (병렬도 정책에 따라 가능).  
   - 전부 성공 시에만 상태 전이; 하나라도 실패 시 중단, 실패 메시지 반환, 상태는 그대로.
2. **arrExecutionTargets 없음**  
   - 기존처럼 `fnFindActiveConnection(nProductId, strEnv)` + `strGeneratedQuery` 1회 실행 (하위 호환).

### 5.4 DB 접속 정보

- **추가 스키마 변경 없이** 현재 구조로 다중 서버/DB 지원 가능.  
- 같은 프로덕트라도 “서버별/DB별”로 접속을 여러 건 등록해 두고, 템플릿 세트에서 `nDbConnectionId`로 선택.

### 5.5 UI 관점

- **쿼리 템플릿 편집**:  
  - 단일(현재) / 세트 모드 선택.  
  - 세트 모드일 때 “DB 연결 선택 + 쿼리 템플릿 + (선택) 기본값”을 리스트로 추가·수정·삭제.
- **이벤트(인스턴스) 생성**:  
  - 입력값 1개. 세트 모드면 각 세트 쿼리에 동일 적용 → 생성 시 백엔드에서 `arrExecutionTargets` 생성.
- **나의 대시보드 / 실행**:  
  - “이번 실행에서 몇 개 서버(대상)에 쿼리할지” 표시.  
  - 실행 결과는 “대상별 성공/실패·영향 행 수” 등으로 표시 가능.

---

## 6. 현재 vs 개선 비교표 (한눈에)

| 구분 | 현재 (단일 서버·단일 DB) | 개선 (다중 서버·다중 DB) |
|------|---------------------------|----------------------------|
| **템플릿** | strQueryTemplate 1개 | arrQueryTemplates[] (세트당 nDbConnectionId + strQueryTemplate) |
| **인스턴스** | strGeneratedQuery 1개 | strGeneratedQuery(단일) 또는 arrExecutionTargets[](세트) |
| **연결 결정** | nProductId + strEnv → 1건 | nDbConnectionId로 접속 직접 지정 → 서버/DB 여러 개 가능 |
| **실행** | 접속 1개에 쿼리 1번 | 접속 N개에 각각 해당 strQuery 1번 (전부 성공 시에만 완료) |
| **호환** | - | arrExecutionTargets 없으면 기존 단일 로직 그대로 사용 |

이미 `IQueryTemplateItem`, `IExecutionTarget`, `arrQueryTemplates`, `arrExecutionTargets` 타입·필드가 있으므로, **실행 분기 복원 + 템플릿/인스턴스 생성 시 세트 처리**만 추가하면 다중 서버·다중 DB 구조로 확장할 수 있습니다.

---

## 7. 상황별 검토 매트릭스 (다중 서버·DB·쿼리·입력값·QA/LIVE)

아래는 **다중 서버, 다중 DB, 다중 쿼리, 다중 입력값, QA/LIVE** 각각이 문서에서 어떻게 다뤄지는지 정리한 표다.

| 구분 | 의미 | 현재 구조 | 개선 구조 | 비고 |
|------|------|-----------|-----------|------|
| **다중 서버** | 이벤트 1건으로 서로 다른 호스트(서버) 여러 대에 실행 | ❌ 미지원 | ✅ 지원 | `arrExecutionTargets`의 `nDbConnectionId`별로 접속이 서로 다른 서버 가능. §3, §4.2, §4.3. |
| **다중 DB** | 서로 다른 DB(호스트/포트/DB명) 여러 개에 실행 | ❌ 미지원 | ✅ 지원 | 접속 정보를 여러 건 등록하고, 세트에서 연결별로 지정. §4.3, §5.4. |
| **다중 쿼리** | (1) 한 연결 안 여러 문장 (2) 연결별로 서로 다른 쿼리 | (1) ✅ (2) ❌ | (1) ✅ (2) ✅ | (1) `strGeneratedQuery` / target의 `strQuery`를 세미콜론으로 분리해 한 트랜잭션으로 실행. (2) 세트당 `strQueryTemplate`이 다르므로 연결별로 다른 쿼리 실행. §1.2, §4.1, §4.5. |
| **다중 입력값** | 세트(또는 연결)별로 **서로 다른** 입력값 사용 | ❌ | ❌ (현재 설계에 없음) | **인스턴스당 입력값은 1개(`strInputValues`)**. 모든 세트에 **동일한 값**이 `{{items}}` 등에 치환됨. 세트별로 다른 입력(예: A세트 "1,2,3", B세트 "4,5,6")이 필요하면 **추후 확장** 필요(예: `arrInputValuesPerSet` 또는 세트별 입력 필드). §4.1, §5.1, §5.5. |
| **QA / LIVE** | 환경별 반영 구분 및 실행 | ✅ | ✅ | `arrDeployScope`, Execute 시 `strEnv: 'qa' \| 'live'`, 접속의 `strEnv`로 필터. QA 반영 / LIVE 반영 각각 독립 실행. §2 전부. |

### 요약

- **다중 서버, 다중 DB, 다중 쿼리(연결별 다른 쿼리 + 한 연결 내 멀티 문장), QA/LIVE** → 모두 검토·반영됨.
- **다중 입력값**(세트별로 다른 입력) → 현재 개선안에는 **포함되지 않음**. 입력은 1개만 두고, 필요 시 별도 스키마/로직 확장으로 검토하면 됨.

---

## 8. 목표 데이터 형태 (QA / LIVE × 세트)

말씀하신 것처럼, 실행 관점에서 보면 **환경별로 세트 목록**이 아래와 같은 모양이 된다.

```
QA
  1세트 (연결 DB, 쿼리, 입력값)
  2세트 (연결 DB, 쿼리, 입력값)
  3세트 (연결 DB, 쿼리, 입력값)
  …

LIVE
  1세트 (연결 DB, 쿼리, 입력값)
  2세트 (연결 DB, 쿼리, 입력값)
  3세트 (연결 DB, 쿼리, 입력값)
  …
```

- **QA 반영 실행** 시: QA에 해당하는 세트들(1세트, 2세트, 3세트 …)만 순서대로 실행. 각 세트는 (연결 DB, 쿼리, 입력값) 한 조.
- **LIVE 반영 실행** 시: LIVE에 해당하는 세트들만 동일하게 실행.

구현 시에는 **세트를 한 리스트로 두고, 연결(DB)의 env로 구분**하는 방식**으로 가져가면 된다.**

- 템플릿/인스턴스: 세트 목록은 **한 배열** (예: `arrQueryTemplates` / `arrExecutionTargets`).
- 각 세트: **(연결 = nDbConnectionId, 쿼리, 입력값)**. 연결 정보에 `strEnv: 'qa' | 'live'` 가 있으므로, “이 세트는 QA용 / LIVE용”이 자동으로 정해짐.
- 실행 시: 요청 `strEnv`와 **같은 env인 연결**만 필터해서 실행 → 화면/개념상으로는 “QA 1,2,3세트 / LIVE 1,2,3세트”처럼 보이게 하면 됨.

**세트별 입력값**은 현재 설계에서는 “인스턴스 공통 1개”만 두고, 세트별로 다르게 두려면 **추가 확장**(예: 세트마다 `strInputValues` 또는 `arrInputValuesPerSet`)으로 반영하면 된다.

---

## 9. 단일 쿼리 / 다중 쿼리 도입 시 변경 사항 목록

탭으로 “단일 쿼리”와 “다중 쿼리”를 구분해 쿼리 템플릿·이벤트 생성·실행까지 반영할 때 필요한 변경 사항이다.

| 구분 | 변경 대상 | 변경 내용 |
|------|-----------|-----------|
| **쿼리 템플릿** | EventPage (프론트) | **탭**: “단일 쿼리” \| “다중 쿼리”. 단일: 기존 폼(strQueryTemplate, strDefaultItems). 다중: 세트 목록(세트당 연결 DB 선택, 쿼리 템플릿, 기본값). 저장 시 단일이면 arrQueryTemplates 비움, 다중이면 arrQueryTemplates 전송·strQueryTemplate 비움(또는 첫 세트만 레거시용). |
| **쿼리 템플릿** | Event API / eventController (백엔드) | GET/POST/PUT에서 arrQueryTemplates 수신·반환 유지 (이미 가능한 경우 많음). 단일 모드일 때 수정 시 strQueryTemplate 있으면 arrQueryTemplates 비우는 로직 유지. |
| **이벤트 생성** | QueryPage (프론트) | 템플릿이 **다중**이면: 입력값 1개로 각 세트 쿼리 템플릿 치환 → 세트별 생성 쿼리 미리보기(선택), 제출 시 **arrExecutionTargets** 생성하여 전송. **단일**이면: 기존처럼 strGeneratedQuery 1개만 전송. |
| **이벤트 인스턴스 생성** | eventInstanceController (백엔드) | POST create 시 arrExecutionTargets 수신·저장 (이미 구현된 경우 유지). 단일이면 strGeneratedQuery만 사용. |
| **쿼리 실행** | eventInstanceController Execute (백엔드) | **arrExecutionTargets** 있으면: 요청 strEnv와 같은 env인 연결만 필터 후 순차 실행, 전부 성공 시에만 상태 전이. 없으면: 기존 단일 접속 + strGeneratedQuery 실행. (현재 단일만 동작하도록 롤백된 상태면 이 분기 복원 필요.) |
| **나의 대시보드** | MyDashboardPage (프론트) | 인스턴스에 arrExecutionTargets가 있으면 “다중 쿼리 N세트” 등 표시(선택). 상세/스테퍼에서 실행 대상 수 표시(선택). |
| **타입** | front/src/types, backend | IQueryTemplateItem, arrExecutionTargets 이미 정의됨. 추가 변경 없어도 됨. |

요약: **쿼리 템플릿**은 단일/다중 탭으로 구분하고, **이벤트 생성**은 선택한 템플릿이 다중이면 arrExecutionTargets를 만들어 제출하며, **실행**은 백엔드에서 arrExecutionTargets 유무에 따라 단일/다중 분기하면 된다.
