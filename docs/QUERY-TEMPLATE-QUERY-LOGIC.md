# 쿼리 템플릿: 단일 쿼리·기본값 vs 다중 쿼리 세트

## 1. 데이터 구조 요약

### 템플릿 (events.json / IEventTemplate)

| 구분 | 필드 | 용도 |
|------|------|------|
| **공통** | `strDefaultItems` | 이벤트 생성 시 **입력란** 기본 채움 (1개). 세트 없을 때·세트 있을 때 모두 사용 가능. |
| **단일(레거시)** | `strQueryTemplate` | **세트를 쓰지 않을 때만** 사용. DB는 프로덕트+환경 기준 1개 연결. |
| **세트** | `arrQueryTemplates[]` | 각 세트: `nDbConnectionId` + `strDefaultItems`(선택) + `strQueryTemplate`. 1개 이상 있으면 **세트 모드**. |

### 세트 1건 (IQueryTemplateItem)

- `nDbConnectionId`: 실행할 DB 접속 ID (필수)
- `strDefaultItems`: 이 세트용 기본값 예시 (선택). 이벤트 생성 시 입력란 채울 때, **공통 기본값이 비어 있으면** 첫 세트의 이 값 사용.
- `strQueryTemplate`: 해당 DB에서 실행할 쿼리 템플릿 (필수)

### 인스턴스 (eventInstances.json / IEventInstance)

- **입력값**은 여전히 **1개**: `strInputValues`. 모든 세트에 동일하게 `{{items}}` 등으로 치환됨.
- **실행 대상**: `strGeneratedQuery`(단일) 또는 `arrExecutionTargets[]`(세트별 nDbConnectionId + strQuery).

---

## 2. 로직 우선순위 (충돌 없음)

### 2-1. 어떤 쿼리를 쓸까?

- `arrQueryTemplates` 가 **있고**, 유효한 항목(DB 연결 선택 + 쿼리 내용 있음)이 **1개 이상**  
  → **세트 모드**: 각 세트의 `strQueryTemplate`에 입력값 치환 → `arrExecutionTargets` 생성.
- 그 외  
  → **단일 모드**: `strQueryTemplate` 1개에 입력값 치환 → `strGeneratedQuery` 1개, 기존처럼 프로덕트+환경 연결 1개 사용.

즉, **세트가 있으면 단일 쿼리는 사용하지 않음**. (세트 추가 시 단일 쿼리는 “선택”으로 두고 무시)

### 2-2. 이벤트 생성 시 “기본 아이템값” 입력란 채우기

- **1순위**: 템플릿 공통 `strDefaultItems` (비어 있지 않으면 사용)
- **2순위**: 세트가 있을 때 **첫 번째 세트**의 `strDefaultItems`
- **3순위**: 둘 다 없으면 빈 문자열

한 번 채워지는 값은 **하나**이고, 그 값이 모든 세트의 `{{items}}`에 동일하게 들어감.  
세트별 `strDefaultItems`는 “이 세트용 예시/힌트”이면서, **공통값이 없을 때만** 첫 세트 값이 입력란 기본값으로 쓰임.

### 2-3. 실행(Execute)

- **세트 모드**: `arrExecutionTargets`만 사용. 요청한 환경(qa/live)과 **같은 env**인 DB 연결만 필터 후, 해당 연결에 해당 `strQuery` 실행.
- **단일 모드**: `strGeneratedQuery` + 프로덕트·환경 기준 연결 1개로 실행.

---

## 3. DB/스키마 관점

- **DB 테이블 추가 없음**. 쿼리 템플릿·이벤트 인스턴스 모두 기존 JSON 파일(events.json, eventInstances.json) 기반.
- **호환**:
  - `arrQueryTemplates` 없거나 비어 있으면 → 기존과 동일하게 `strQueryTemplate` + `strDefaultItems`만 사용.
  - 세트에 `strDefaultItems` 없어도 동작 (선택 필드).

---

## 4. 요약

| 항목 | 쿼리 + 기본값 (기존) | 쿼리 템플릿 세트 |
|------|----------------------|-------------------|
| 기본값 | `strDefaultItems` 1개 | 세트별 `strDefaultItems`(선택), 공통 없을 때 첫 세트 값으로 입력란 채움 |
| 쿼리 | `strQueryTemplate` 1개 | 세트당 `nDbConnectionId` + `strQueryTemplate` |
| 사용 조건 | 세트 없을 때 | 세트 1개 이상 있을 때 (단일 쿼리 무시) |
| 인스턴스 입력 | `strInputValues` 1개 (동일) | 동일 1개가 모든 세트에 치환 |

충돌 없이, “기존 쿼리+기본값”과 “세트(DB 연결 + 기본 아이템값 + 쿼리)”가 공존하고, **세트 존재 여부**로만 단일/세트 모드가 결정됩니다.
