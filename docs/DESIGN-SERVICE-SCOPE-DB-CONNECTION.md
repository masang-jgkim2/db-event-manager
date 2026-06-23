# 설계안: 서비스 범위(프로젝트) ↔ DB 접속·이벤트 생성 연동

> **상태**: Phase 1 구현됨 (2026-05) — 접속·실행·QueryPage 검증. MyDashboard 컬럼 분리·Step4 접속 미리보기는 미구현.  
> **관련**: `docs/DESIGN-TEMPLATE-INSTANCE-WORKFLOW-SPLIT.md` (Phase 1~3), `docs/REVIEW-MULTI-SERVER-MULTI-DB.md`  
> **작성 목적**: 프로덕트 하위 «서비스 범위(프로젝트)»를 DB 접속·쿼리 생성·실행·대시보드에 일관되게 묶는 변경의 검토·범위 정리

---

## 1. 배경

### 1.1 현재

| 영역 | 동작 |
|------|------|
| **프로덕트** | `arrServices[]` — `{ strAbbr, strRegion }` (ProductPage «서비스 범위» 컬럼) |
| **DB 접속** | `nProductId` + `strServiceAbbr?` + `strEnv`(qa/live) + `strKind` — 서비스 전용→공통 fallback |
| **이벤트 생성** | Step 2 «서비스 범위(프로젝트)» → QA/LIVE·종류별 접속 검증 |
| **QA/LIVE 실행** | `fnResolveExecuteConnection(..., strServiceAbbr)` — 인스턴스 Step2 값 |
| **나의 대시보드** | 프로덕트 열: `strProductName (strServiceAbbr)` 혼합 표기 |

쿼리 SQL 자체에 QA/LIVE IP가 들어가지 않음. 환경은 **실행 API `strEnv` + `db_connection.strEnv`** 로 결정.

### 1.2 문제

- DK온라인 **국내(DK/KR)** vs **스팀(DK/G)** 이 QA/LIVE DB가 다를 때, 접속·실행이 **프로덕트만** 보므로 서비스와 어긋날 수 있음.
- 템플릿 세트 `nDbConnectionId`는 템플릿 등록 시 고정, **Step 2 서비스와 자동 매칭 없음**.

### 1.3 목표 (본 설계)

- **서비스 범위(프로젝트)** = 프로덕트 `arrServices` 한 줄 (`strAbbr` + `strRegion`)을 **DB 접속·이벤트·대시보드**에서 동일 키로 참조.
- 이벤트 생성 Step 2~3 이후 **QA/LIVE 접속(host/DB) 미리보기** 가능.
- 나의 대시보드: **프로덕트명**과 **서비스 범위** 컬럼 분리.

### 1.4 비목표 · 선행 작업

- **선행**: `feat/template-instance-workflow-split` — 템플릿 3단계 워크플로, D1, (예정) Phase 3 인스턴스 7단계.
- 본 설계는 위 작업 **완료 후** 구현.

---

## 2. 용어 · 마스터 데이터

### 2.1 서비스 범위(프로젝트)

| 필드 | 출처 | 예 |
|------|------|-----|
| 프로덕트 | `IProduct.strName` | `DK온라인` |
| 리전 | `IService.strRegion` | `국내`, `스팀`, `글로벌`, `유럽`, `일본` |
| 약자(키) | `IService.strAbbr` | `DK/KR`, `DK/G`, `AD/G` |

**표시 통일** (ProductPage·QueryPage·DB 접속·대시보드):

- 태그: **`strAbbr (strRegion)`** — 예: `DK/G (스팀)`
- QueryPage 라벨: `국내(한국)`, `해외(스팀)` 등 (기존 `strRegion` 매핑 재사용)

### 2.2 운영 예시 (약자는 `products.json` 기준, 필요 시 정리)

| 프로덕트 / 리전 | strAbbr (현재 시드) |
|-----------------|---------------------|
| 출조낚시왕 / 국내 | `FH` (운영상 `FH/KR` 통일 검토) |
| DK온라인 / 국내 | `DK/KR` |
| DK온라인 / 스팀 | `DK/G` |
| 아스다글로벌 / 글로벌 | `AD/G` |
| 에이스온라인 / 국내·유럽 | `AO/KR`, `AO/EU` |
| 라그하임 / 국내 | `LH` (운영상 `LH/KR` 통일 검토) |

---

## 3. 핵심 설계

### 3.1 DB 접속 (`IDbConnection` 확장)

```typescript
// 신규 optional — products.arrServices[].strAbbr 와 일치
strServiceAbbr?: string;
```

| strServiceAbbr | 의미 |
|----------------|------|
| **값 있음** | 해당 프로덕트·해당 서비스 전용 QA/LIVE 접속 |
| **비움** | 프로덕트 **공통** fallback (모든 서비스 후보) |

**UI (DbConnectionPage)**

- 테이블: **프로덕트** | **서비스 범위(프로젝트)** | 환경 | 종류 | …
- 모달: 프로덕트 Select → 서비스 범위 Select (`arrServices` 필터)

**중복 키**: `nProductId + strServiceAbbr? + strEnv + strKind + host + strDatabase`

**MySQL**: `db_connection.str_service_abbr VARCHAR(...) NULL` + 인덱스 `(n_product_id, str_service_abbr, str_env)` 검토

### 3.2 접속 해석 (`fnResolveExecuteConnection` 확장)

```typescript
fnResolveExecuteConnection(
  nProductId,
  strEnv,
  nDbConnectionId?,
  strServiceAbbr?,  // 신규 — 인스턴스 Step 2 값
)
```

**우선순위 (안)**

1. `nDbConnectionId` 지정 + 프로덕트 일치 + (있으면) 서비스 일치 → env 맞으면 그대로, 아니면 **동일 kind + 동일 strServiceAbbr + env** 활성 접속
2. `nDbConnectionId` 없음 → `product + strServiceAbbr + env + GAME` 활성 1건
3. 서비스 전용 없으면 → `strServiceAbbr` 비운 **공통** 접속 fallback

### 3.3 이벤트 생성 (QueryPage)

| Step | 변경 |
|------|------|
| 1 | 프로덕트 (유지) |
| 2 | 제목 **«서비스 범위(프로젝트)»** (기존 «국내/해외 선택») |
| 3 | 쿼리 템플릿 (유지) |
| 4 | 값 입력 + **QA/LIVE 접속 미리보기** (신규) |

**Step 3 이후 미리보기 (목표 UX)**

- 템플릿 `arrQueryTemplates` + Step 2 `strServiceAbbr` 로 세트별 해석
- 예: `QA: 10.x.x.x:1433/GameDB`, `LIVE: 20.x.x.x:1433/GameDB`
- `arrExecutionTargets` 저장 시 **서비스에 맞는 `nDbConnectionId`** 로 치환

**QA/LIVE 가능 검사**: `nProductId + strServiceAbbr + qa|live` (현재는 `nProductId + env` 만)

**주의**: 템플릿 «연결 DB»는 **DB 구분(GAME/LOG 등)** 용. QA/LIVE는 접속 행의 `strEnv`. Step 3만으로 IP 확정되려면 **3.1·3.2 선행 필수**.

### 3.4 쿼리 템플릿 (선택)

| 방식 | 설명 |
|------|------|
| **A (권장 1차)** | 템플릿 1개·SQL 공통 → Step 2 서비스로 **접속만** 해석 |
| **B** | `IEventTemplate.strServiceAbbr` — 서비스별 템플릿 필터 |
| **C** | 서비스마다 SQL 다르면 템플릿 자체를 분리 |

1차는 **A**; EventPage 연결 DB 목록도 `nProductId + (선택) strServiceAbbr` 필터.

### 3.5 나의 대시보드

| 컬럼 | 내용 |
|------|------|
| **프로덕트** | `strProductName` only |
| **서비스 범위(프로젝트)** | `strRegion` 표시 라벨 + `strServiceAbbr` (예: `스팀 · DK/G`) |

상세/수정: `strProductName (strServiceAbbr / strRegion)` 유지 가능.

---

## 4. 데이터 흐름 (목표)

```
products.arrServices (마스터)
       ↓ strServiceAbbr
db_connection (프로덕트 + 서비스 + qa/live)
       ↓ fnResolveExecuteConnection(..., strServiceAbbr)
QueryPage Step 2~4 → arrExecutionTargets
       ↓ execute strEnv
QA/LIVE 게임 DB 실행
```

---

## 5. 구현 체크리스트 (착수 시)

### Backend

- [x] `IDbConnection.strServiceAbbr`, DDL, `mysqlRelationalSync`
- [x] `dbConnectionController` — 검증(프로덕트 `arrServices` 포함 여부), 중복 키
- [x] `fnResolveExecuteConnection` + `strServiceAbbr` fallback
- [ ] (선택) `GET /api/db-connections?nProductId=&strServiceAbbr=` 필터

### Frontend

- [x] `DbConnectionPage` — 테이블·모달 «서비스 범위(프로젝트)»
- [x] `QueryPage` — Step 2 제목, QA/LIVE 검사, targets 해석(실행 시 백엔드)
- [x] `EventPage` — 연결 DB Select에 서비스 범위 라벨
- [ ] `MyDashboardPage` — 프로덕트 / 서비스 범위 컬럼 분리
- [ ] `QueryPage` Step 4 접속 미리보기
- [ ] 공통: `fnFormatServiceScopeLabel(abbr, region)` 유틸 (ProductPage 태그와 동일)

### 테스트 · 데이터

- [x] 단위: 서비스별 QA/LIVE 해석, fallback, DK/G vs DK/KR
- [ ] API 통합: 미등록 서비스 400
- [ ] (선택) `products.json` 약자 통일 (`FH/KR`, `LH/KR`)
- [ ] E2E: DK/KR vs DK/G 다른 접속 시 올바른 DB 실행

### Rules/Docs (구현 후)

- [ ] `domain-db-connection.mdc`, `SKILL.md`, `frontend-patterns.mdc`

---

## 6. 리스크

| 리스크 | 완화 |
|--------|------|
| 기존 접속 `strServiceAbbr` 없음 | 비움 = 공통 fallback, 기존 동작 유지 |
| 템플릿·서비스 불일치 | Step 3~4 미리보기 + 생성 전 400 |
| 인스턴스 Phase 3(7단계)와 동시 수정 | **템플릿/인스턴스 분리 먼저 merge 후** 본 브랜치 착수 |

---

## 7. 관련 파일 (예상)

```
backend/src/types/index.ts          IDbConnection
backend/src/data/dbConnections.ts   fnResolveExecuteConnection
backend/src/controllers/dbConnectionController.ts
backend/src/db/mysqlAppSchema.ts
front/src/pages/DbConnectionPage.tsx
front/src/pages/QueryPage.tsx
front/src/pages/EventPage.tsx
front/src/pages/MyDashboardPage.tsx
front/src/pages/ProductPage.tsx     (용어·표시 기준)
```
