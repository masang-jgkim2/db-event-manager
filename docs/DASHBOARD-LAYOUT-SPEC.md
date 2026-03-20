# 나의 대시보드 — 위젯·레이아웃 설정 초안

> **전제**: 이벤트 인스턴스 등 **실데이터 스키마/API는 변경하지 않음**.  
> 모든 수치·목록은 기존 조회 결과(`GET /api/event-instances` 등)에서 **클라이언트 집계** 또는 동일 API 재사용.

---

## 1. 위젯 타입 (`strWidgetType`)

| 타입 값 | 설명 | 데이터 출처(개념) |
|---------|------|-------------------|
| `status_summary` | `strStatus` 기준 건수 (바 차트 / 통계 카드 / 칩) | 인스턴스 목록 집계 |
| `product_summary` | 프로덕트(또는 **그룹**)별 건수 | `nProductId` 또는 그룹 매핑 후 집계 |
| `instance_list` | 필터된 인스턴스 리스트 (테이블·간단 카드 리스트) | 동일 목록, `IFilter` 적용 |
| `deploy_calendar` | 배포일(`dtDeployDate`) 기준 월/주 블록 | 인스턴스 목록에서 날짜별 그룹 |
| `my_action_count` | 내 처리 대기 건수 등 (기존 통계와 동일 개념) | 권한+상태 기준 필터 후 count |
| `actor_summary` | 담당자(생성자/특정 단계 actor)별 건수 | `objCreator`, `obj*Deployer` 등 |
| `text_note` | 안내문/링크 (데이터 바인딩 없음) | 설정 문자열만 |
| `placeholder` | 추후 위젯 자리 표시 | — |

필요 시 확장: `timeline_compact`, `sla_risk` 등.

---

## 2. 프로덕트 그룹 (라벨)

인스턴스 테이블을 건드리지 않고, **표시용 그룹**만 정의.

```typescript
// 개념 타입 (문서용)
interface IProductGroup {
  strGroupId: string;           // 위젯에서 참조
  strLabel: string;             // UI 라벨
  arrProductIds: number[];      // nProductId 목록
  strColor?: string;            // 선택: 카드 테두리/칩 색
}
```

저장 위치 후보: `dashboardProductGroups.json` 또는 레이아웃 파일 상단 `arrProductGroups`.

---

## 3. 공통 필터 (`IFilter`)

위젯마다 선택 적용. 서버 필터 쿼리와 맞출 수 있음.

```typescript
interface IDashboardFilter {
  /** 서버 목록 필터: all | involved | mine | my_action */
  strInstanceFilter?: 'all' | 'involved' | 'mine' | 'my_action';
  /** 포함할 상태(비우면 전체) */
  arrStatus?: string[];
  /** 특정 프로덕트 ID만 */
  arrProductIds?: number[];
  /** strGroupId → 서버 전에는 arrProductIds로 확장 */
  arrProductGroupIds?: string[];
  /** 삭제됨(bPermanentlyRemoved) 제외 기본 true 권장 */
  bExcludeDeleted?: boolean;
}
```

---

## 4. 위젯 정의 (`IDashboardWidget`)

```typescript
interface IDashboardWidget {
  strWidgetId: string;          // 레이아웃 내 unique
  strWidgetType: string;       // 위 1절 타입
  strTitle?: string;            // 카드 제목 오버라이드
  objFilter?: IDashboardFilter;
  /** 타입별 옵션 (늣은 필드만 채움) */
  objOptions?: Record<string, unknown>;
}
```

### `objOptions` 예시 (타입별)

**`status_summary`**
```json
{
  "strDisplay": "chips",
  "bShowZero": false
}
```

**`product_summary`**
```json
{
  "strGroupBy": "group",
  "strDisplay": "horizontal_bars"
}
```
- `strGroupBy`: `"product"` | `"group"` (그룹 정의 사용 시)

**`instance_list`**
```json
{
  "strView": "table",
  "nPageSize": 10,
  "strDensity": "compact",
  "arrColumns": ["strEventName", "strStatus", "strProductName", "dtDeployDate"]
}
```
- `strView`: `"table"` | `"card"`. **`card`** 일 때 여러 줄 **라벨 ← 데이터**는 §5 `arrCardRows` 로 정의.

**`deploy_calendar`**
```json
{
  "strView": "month",
  "nWeeksAhead": 4
}
```

**`text_note`**
```json
{
  "strMarkdown": "금주 QA 점검 일정은 …"
}
```

## 5. 인스턴스 카드 — 여러 라벨 ← 데이터 (`arrCardRows`)

한 장의 이벤트 카드 안에 **행을 원하는 만큼** 정의. 왼쪽(또는 위) **표시 라벨**, 오른쪽(또는 아래) **인스턴스 필드 값**.

```typescript
/** 한 행 = 라벨 + 데이터 바인딩 1건 */
interface ICardLabelRow {
  /** UI에 보이는 라벨 (예: "프로덕트", "반영 일시") */
  strLabel: string;
  /**
   * IEventInstance 상의 키 경로. 점 없으면 최상위 필드명.
   * 예: "strProductName", "strStatus", "dtDeployDate", "strCreatedBy",
   * "objCreator.strDisplayName"
   */
  strFieldPath: string;
  /** 표시 방식 — 미지정이면 text */
  strRender?: 'text' | 'datetime_short' | 'datetime_full' | 'status_tag' | 'tag' | 'env_tag';
  /** 값이 비었을 때 */
  strEmpty?: string;
  /** 라벨 열 너비 (옵션, CSS/그리드용) — 예: "88px", "30%" */
  strLabelWidth?: string;
  /**
   * 카드 **내부** 위치 (선택). 미지정이면 `strCardInnerLayout`·`nInnerColumns` 기본에 맞춰 순서대로 채움.
   * `nInnerColumns: 2` 일 때 `nGridColumn: 1 | 2` 로 왼쪽/오른쪽 열 배치.
   */
  nGridColumn?: number;
  nGridRow?: number;
  /** 그리드에서 차지할 열 수 (기본 1) */
  nColSpan?: number;
}

/** instance_list 위젯 objOptions 예시 */
interface IInstanceListCardOptions {
  strView?: 'table' | 'card';
  arrCardRows?: ICardLabelRow[];
  nPageSize?: number;
  /** 카드 본문: 세로 스택(기본) vs 다열 그리드 */
  strCardInnerLayout?: 'stack' | 'grid';
  /** `grid` 일 때 열 개수 (예: 2 → 한 줄에 라벨-값 쌍이 좌/우로) */
  nInnerColumns?: number;
  strInnerGap?: string;
}
```

### JSON 예시 (`objOptions`)

```json
{
  "strView": "card",
  "arrCardRows": [
    { "strLabel": "프로덕트", "strFieldPath": "strProductName", "strRender": "tag", "strEmpty": "-" },
    { "strLabel": "서비스", "strFieldPath": "strServiceAbbr", "strRender": "text" },
    { "strLabel": "반영 일시", "strFieldPath": "dtDeployDate", "strRender": "datetime_short" },
    { "strLabel": "상태", "strFieldPath": "strStatus", "strRender": "status_tag" },
    { "strLabel": "생성자", "strFieldPath": "strCreatedBy", "strEmpty": "-" },
    { "strLabel": "생성일", "strFieldPath": "dtCreatedAt", "strRender": "datetime_short" }
  ],
  "nPageSize": 12
}
```

**2열 그리드 + 행별 열 지정** (같은 카드 안에서 좌/우 배치):

```json
{
  "strView": "card",
  "strCardInnerLayout": "grid",
  "nInnerColumns": 2,
  "strInnerGap": "8px 16px",
  "arrCardRows": [
    { "strLabel": "이벤트", "strFieldPath": "strEventName", "nGridColumn": 1, "nColSpan": 2 },
    { "strLabel": "프로덕트", "strFieldPath": "strProductName", "nGridColumn": 1 },
    { "strLabel": "상태", "strFieldPath": "strStatus", "strRender": "status_tag", "nGridColumn": 2 },
    { "strLabel": "반영일", "strFieldPath": "dtDeployDate", "strRender": "datetime_short", "nGridColumn": 2 }
  ]
}
```

### 렌더링 가이드

- **한 장의 카드 = 한 인스턴스**: `arrCardRows` **행 개수만큼** 라벨←데이터 줄이 들어감 (무제한에 가깝게 확장 가능).
- **기본 위치**: 배열 인덱스 순서 = 위→아래. `strCardInnerLayout: "stack"`(기본)이면 한 열 세로 나열.
- **열·셀 위치**: `strCardInnerLayout: "grid"` + `nInnerColumns`(예: `2`) 로 카드 안을 N열 그리드로 쪼개고, 각 `ICardLabelRow` 의 `nGridColumn` / `nGridRow` / `nColSpan` 으로 **어느 칸에 둘지** 지정 (미지정이면 자동 배치: 행 순서대로 빈 칸 채움).
- **행 단위**: `Row` + `Col` 또는 `display: grid; grid-template-columns: var(--labelW) 1fr;` 로 **라벨 | 값** 정렬 (`strLabelWidth` 와 조합).
- **확장**: 나중에 `strFieldPath` 대신 `strExpr` (템플릿) 추가 가능.
- **데이터**: **`IEventInstance` 한 건** — 스키마 변경 없음.

> **드래그로 행/칸 위치 바꾸기**는 UI 편집기에서 `arrCardRows` 순서·`nGridColumn` 등을 갱신해 저장하는 방식으로 두면 됨 (실데이터 API와 무관).

---

## 6. 레이아웃 루트 JSON

```json
{
  "strSchemaVersion": "1.0",
  "strLayoutId": "default",
  "strLabel": "운영 기본 보드",
  "arrProductGroups": [
    {
      "strGroupId": "fishing",
      "strLabel": "낚시 계열",
      "arrProductIds": [1, 2],
      "strColor": "blue"
    }
  ],
  "arrWidgets": [
    {
      "strWidgetId": "w-status",
      "strWidgetType": "status_summary",
      "strTitle": "프로세스별 진행",
      "objFilter": {
        "strInstanceFilter": "involved",
        "bExcludeDeleted": true
      },
      "objOptions": { "strDisplay": "chips", "bShowZero": false }
    },
    {
      "strWidgetId": "w-list",
      "strWidgetType": "instance_list",
      "strTitle": "내 관여 이벤트",
      "objFilter": {
        "strInstanceFilter": "involved",
        "bExcludeDeleted": true
      },
      "objOptions": {
        "nPageSize": 8,
        "strDensity": "compact"
      }
    },
    {
      "strWidgetId": "w-cal",
      "strWidgetType": "deploy_calendar",
      "objFilter": { "bExcludeDeleted": true },
      "objOptions": { "strView": "month", "nWeeksAhead": 4 }
    }
  ],
  "arrLayoutRows": [
    {
      "nOrder": 0,
      "strHeight": "auto",
      "arrColumnSpans": [
        { "strWidgetId": "w-status", "nColSpan": 24 },
        { "strWidgetId": "w-cal", "nColSpan": 12 },
        { "strWidgetId": "w-list", "nColSpan": 12 }
      ]
    }
  ]
}
```

- `arrLayoutRows`: Ant Design **24 그리드** 가정 시 `nColSpan` 합이 행당 24가 되도록 구성 (세부는 구현 단계에서 조정).
- 드래그 그리드 도입 시 `x`, `y`, `w`, `h` 등으로 교체 가능.

---

## 7. 저장·로드 정책 (구현 시)

| 단계 | 방식 |
|------|------|
| 프로토타입 | `front/src/constants/dashboardLayoutDefault.ts`(`OBJ_DEFAULT_DASHBOARD_LAYOUT`) 임포트 + 사용자별 **localStorage** 오버레이 |
| 확장 | `backend/data/dashboardLayouts.json` (사용자 ID별 키) 또는 RBAC 이후 **설정 전용 API** |

---

## 8. 데이터 흐름 (변경 없음 강조)

1. 위젯은 **설정만** 가진다.
2. 마운트 시 스토어/API로 **이미 쓰는 인스턴스 목록**을 가져온다.
3. `objFilter`·`arrProductGroups`를 적용해 **메모리에서 집계/슬라이스**한다.
4. SSE 갱신 시 **동일 스토어**를 구독하면 위젯도 같이 갱신.

---

## 9. 다음 구현 단계 제안

1. 타입스크립트 인터페이스: `front/src/types/dashboardLayout.ts` (위 스키마 반영, `ICardLabelRow`·`instance_list.objSettings.arrCardRows` 포함).
2. 기본 JSON 1개 + `status_summary` / `instance_list` 2종만 연결해 **프로토 페이지** 또는 기존 대시보드 하단에 삽입.
3. `instance_list` 에서 `strView: "card"` + `arrCardRows` 렌더 (라벨 ← 값).
4. `deploy_calendar`·`product_summary`(그룹) 순으로 확장.

문서 끝.
