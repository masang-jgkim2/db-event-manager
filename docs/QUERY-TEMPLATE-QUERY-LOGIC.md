# 쿼리 템플릿: 단일 쿼리·기본값 vs 다중 쿼리 세트

## 1. 데이터 구조 요약

### 템플릿 (events.json / IEventTemplate)

| 구분 | 필드 | 용도 |
|------|------|------|
| **공통** | `strDefaultItems` | 이벤트 생성 시 **레거시 기본값** (단일 모드·세트 모드 fallback). |
| **단일(레거시)** | `strQueryTemplate` | **세트를 쓰지 않을 때만** 사용. DB는 프로덕트+환경 기준 1개 연결. |
| **세트** | `arrQueryTemplates[]` | 각 세트: QA/LIVE `nDbConnectionId` + `strQueryTemplate` + `arrInputs[]`(선택). 1개 이상 있으면 **세트 모드**. |

### 세트 1건 (IQueryTemplateItem)

- `nQaDbConnectionId` / `nLiveDbConnectionId`: 실행할 DB 접속 ID (필수)
- `arrInputs[]`: 세트 안 **입력 슬롯** — `strInputId`, `strInputFormat`, `strDefaultItems`(선택). 없으면 레거시 `strInputId`/`strInputFormat`/`strDefaultItems` 1슬롯 dual-read.
- `strDefaultItems`: 세트 단위 레거시 기본값 (선택). 슬롯별 기본값이 없을 때 fallback.
- `strQueryTemplate`: 해당 DB에서 실행할 쿼리 템플릿 (필수)

### 인스턴스 (eventInstances.json / IEventInstance)

- **입력값** `strInputValues`:
  - **신규**: JSON `{ "v": 1, "sets": [ { "item_id": "…", "qty": "1" }, … ] }` — 세트 인덱스 = `sets[]`, 세트 안 키 = 슬롯 `strInputId`
  - **레거시**: `\u0001`로 세트당 문자열 1개 — 읽기 dual-read
- **실행 대상**: `strGeneratedQuery`(단일) 또는 `arrExecutionTargets[]`(세트별 QA/LIVE id + strQuery).
- **세트 안 슬롯**: 템플릿 `arrInputs[]`. 레거시 `strInputId`/`strInputFormat`은 첫 슬롯 미러.
- **MySQL 메타**: `event_template_query_set.json_arr_inputs` (+ `str_input_id`/`str_input_format`/`str_default_items` 첫 슬롯 미러).
- **비지원(1차)**: `VALUES ({{a}},{{b}})`에 목록을 넣어 행 zip.

---

## 2. 로직 우선순위 (충돌 없음)

### 2-1. 어떤 쿼리를 쓸까?

- `arrQueryTemplates` 가 **있고**, 유효한 항목(DB 연결 선택 + 쿼리 내용 있음)이 **1개 이상**  
  → **세트 모드**: 각 세트의 `strQueryTemplate`에 **해당 세트 슬롯 map** 치환 → `arrExecutionTargets` 생성.
- 그 외  
  → **단일 모드**: `strQueryTemplate` 1개에 입력값 치환 → `strGeneratedQuery` 1개, 기존처럼 프로덕트+환경 연결 1개 사용.

즉, **세트가 있으면 단일 쿼리는 사용하지 않음**. (세트 추가 시 단일 쿼리는 “선택”으로 두고 무시)

### 2-2. 이벤트 생성 시 입력란 기본 채우기 (QueryPage)

**단일 모드** (유효 세트 없음)

- 템플릿 `strDefaultItems` → 단일 입력란 1개.

**세트 모드** (유효 세트 1개 이상)

- 세트마다 `Record<strInputId, string>` map을 만든다.
- **슬롯별 1순위**: `arrInputs[n].strDefaultItems` (비어 있지 않으면 해당 슬롯 ID에 채움).
- **레거시 fallback** (해당 세트에 슬롯 기본값이 하나도 없을 때만):
  1. 템플릿 공통 `strDefaultItems`
  2. 없으면 해당 세트 `strDefaultItems`
  3. 위 값을 **첫 번째 활성 슬롯**(`strInputFormat !== 'none'`, 없으면 첫 슬롯) **한 곳**에만 채움.
- 저장 시 `strInputValues` = JSON `{ v: 1, sets: [ … ] }` (`fnEncodeInstanceInputValues`).
- 치환: 세트별 map → `fnReplaceAllInputsInTemplate` (슬롯 ID별 한 패스).

### 2-3. 실행(Execute)

- **세트 모드**: `arrExecutionTargets`만 사용. 요청한 환경(qa/live)과 **같은 env**인 DB 연결만 필터 후, 해당 연결에 해당 `strQuery` 실행.
- **단일 모드**: `strGeneratedQuery` + 프로덕트·환경 기준 연결 1개로 실행.

---

## 3. DB/스키마 관점

- **JSON 모드** (`DATA_STORE=json`): `events.json`, `eventInstances.json` — 구조는 위와 동일.
- **MySQL 메타** (`DATA_STORE=mysql`): 정규화 테이블 + `event_template_query_set.json_arr_inputs`(JSON). 첫 슬롯은 `str_input_id`/`str_input_format`/`str_default_items`에 미러. 인스턴스 `strInputValues`는 TEXT( JSON 문자열 또는 레거시 `\u0001` ).
- **호환**:
  - `arrQueryTemplates` 없거나 비어 있으면 → `strQueryTemplate` + `strDefaultItems` 단일 모드.
  - `arrInputs` 없으면 → 세트 `strInputId`/`strInputFormat`/`strDefaultItems` 1슬롯 dual-read.
  - 인스턴스 JSON·`\u0001` dual-read — 구 데이터 마이그레이션 없이 읽기.

---

## 4. 요약

| 항목 | 단일(레거시) | 세트 모드 |
|------|-------------|-----------|
| 템플릿 쿼리 | `strQueryTemplate` 1개 | 세트당 `strQueryTemplate` + QA/LIVE 연결 |
| 입력 정의 | `strInputId`/`strInputFormat` | `arrInputs[]` (슬롯별 ID·형식·기본값) |
| 생성 시 기본값 | `strDefaultItems` 1개 | 슬롯별 `strDefaultItems` → 없으면 공통/세트 fallback → 첫 활성 슬롯 |
| 인스턴스 입력 | `strInputValues` 문자열 1개 | JSON `sets[]` (세트×슬롯 map) 또는 레거시 `\u0001` |
| 치환 | `{{items}}` 등 1값 | 슬롯 ID별 map (`fnReplaceAllInputsInTemplate`) |

충돌 없이, “기존 쿼리+기본값”과 “세트(DB 연결 + 슬롯 + 쿼리)”가 공존하고, **세트 존재 여부**로만 단일/세트 모드가 결정됩니다.
