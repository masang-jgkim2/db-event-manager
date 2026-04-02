# 대시보드 통계·차원별 현황 — 구현 가능성 검토

> 브랜치: `feature/dashboard-stats-feasibility`  
> 목표: 사용자별 / 프로덕트별 / 쿼리 템플릿별 작업 현황 등 통계를 카드·테이블로 보고, 라벨–데이터 연동을 확장할 수 있는지 검토.

---

## 1. 대시보드가 두 갈래임

| 화면 | 파일 | 역할 |
|------|------|------|
| **이벤트 메뉴 → 대시보드** | `front/src/pages/DashboardPage.tsx` | 숫자 카드·상태별 카드·맞춤 카드·프로덕트 테이블, DnD·localStorage |
| **나의 대시보드** | `front/src/pages/MyDashboardPage.tsx` | 인스턴스 목록·상태 요약·캘린더 등 (`docs/DASHBOARD-LAYOUT-SPEC.md`와 타입 정의는 있으나, 위젯 전부를 JSON으로 구동하는 단계는 아님) |

통계 요구가 **이벤트 대시보드**에 가깝다면 `DashboardPage` 확장이 1차 타깃, **나의 대시보드**와 통일하려면 레이아웃 스펙 + 렌더러를 맞추는 2차 작업이 필요함.

---

## 2. 현재 구조로 “무엇까지” 되는가

### 2.1 이미 있는 것

- **인스턴스 원천 데이터**: `GET /api/event-instances` 등으로 목록 수신 후 **프론트에서 집계** 가능 (스펙상 실데이터 스키마 변경 없이 집계하는 전제와 동일).
- **필드 예시** (통계에 쓰기 좋음):
  - 사용자/담당: `strCreatedBy`, 단계별 `objQaDeployer` / `objLiveDeployer` 등
  - 프로덕트: `nProductId`, `strProductName`
  - 쿼리 템플릿(인스턴스가 참조): `nEventTemplateId`, `strEventName`
  - 진행: `strStatus`, `dtDeployDate`, `dtCreatedAt` 등
- **맞춤 카드** (`ICustomEventDashboardCard`): 제목 + **라벨–지표 행** + (선택) **이벤트 그룹**(상태·기간 필터) 테이블.
- **지표 ID** (`strMetricId`): 현재는 `NUMBER_CARD_IDS`에 등록된 **고정 목록**만 (프로덕트 수, 인스턴스 수, 상태별 건수 등). 임의 차원(사용자별 건수)은 **아직 ID로 노출되지 않음**.
- **프로덕트 테이블 카드**: 컬럼이 `productTable`용으로 **고정 정의** (`OBJ_TABLE_CARD_COLUMNS`). 임의 스키마 바인딩은 아님.
- **나의 대시보드 레이아웃 타입**: `dashboardLayout.ts`에 `product_summary`, `actor_summary` 등 **문서·타입만** 있고, `DASHBOARD-LAYOUT-SPEC.md`에도 동일 개념이 있음 → **UI 구현은 미완/부분**에 가깝다고 보면 됨.

### 2.2 “자유롭게 라벨–데이터 연동”에 가까운 기존 패턴

- **인스턴스 카드 행**: `ICardLabelRow` (`strLabel` + `strFieldPath` + `strRender`) — **나의 대시보드** `instance_list` 위젯 옵션에서 사용. **대상은 인스턴스 한 건의 필드**이지, “집계 테이블 한 셀”은 아님.

---

## 3. 요구사항 대응 가능 여부 (결론)

| 요구 | 현재만으로 | 비고 |
|------|------------|------|
| 사용자별 작업 현황 | **데이터는 가능**, **UI는 확장 필요** | 인스턴스 배열을 `strCreatedBy`(또는 actor 필드)로 `reduce`/`Map` 집계 후 테이블·바 차트로 표시하면 됨. |
| 프로덕트별 작업 현황 | 동일 | `nProductId` / `strProductName` 기준 집계. |
| 쿼리 템플릿별 작업 현황 | 동일 | `nEventTemplateId` / `strEventName` 기준 집계. |
| 카드에 라벨–숫자 연동 | **부분 가능** | 맞춤 카드의 “라벨–지표”는 **등록된 metricId**에 한정. 새 집계를 **metricId + 집계 함수**로 추가하면 확장 가능. |
| 테이블에 임의 컬럼·집계 연동 | **제한적** | `productTable` 패턴을 **일반화**(예: `dimension` + `columns` 설정)하거나, 새 카드 타입 `aggregateTable` 추가가 필요. |

**종합**: **백엔드 스키마 변경 없이**, 프론트에서 인스턴스(및 필요 시 프로덕트/템플릿 목록)를 받아 **집계 로직 + 위젯/카드 타입 확장**으로 **구현 가능**. 다만 “완전 자유 JSON만으로 필드 경로 임의 바인딩”은 **집계 결과 객체의 키와 컬럼 매핑을 정의하는 스키마**를 새로 정하는 수준이 필요함 (보안·타입 안정성 측면에서도 권장).

---

## 4. 구현 방향 제안 (우선순위)

1. **집계 유틸** (`fnAggregateInstancesBy(dim: 'creator' | 'product' | 'template', …)`): 한 곳에 모아 재사용.
2. **이벤트 대시보드**에 **통계 테이블 카드** 1종 추가 (설정: 차원 + 표시 컬럼 + 선택 필터) 또는 **맞춤 카드**에 “미리 정의된 집계 지표” ID 추가.
3. 인스턴스 건수가 커지면 **서버 집계 API**(`GET /api/event-instances/stats?groupBy=…`) 검토 — 현재는 인메모리라 서버 집계도 가능하나, API 설계·권한 정리 필요.

---

## 5. 리스크·주의

- **localStorage**: 이벤트 대시보드 카드 설정은 로컬 위주 → 팀 공유·백업은 별도 정책.
- **권한**: 통계에 “전체 인스턴스”가 필요하면 API가 **역할에 맞는 목록만** 주는지 확인 (`all` vs `mine` 등).
- **성능**: 전량 `all` 로드 후 클라이언트 집계는 데이터 증가 시 한계 → 그때 서버 집계로 이행.

---

## 6. 다음 작업(이 브랜치에서 할 수 있는 것)

- [ ] 위 집계 유틸 + 프로토타입 카드(또는 테이블) 1개
- [ ] `DASHBOARD-LAYOUT-SPEC.md` / `actor_summary`·`product_summary` 와 실제 UI 연결 여부 정리
- [ ] (선택) `docs`에 사용자 시나리오 2~3개만 예시로 추가

이 문서는 검토용이며, 실제 기능 PR은 별도 커밋으로 쪼개는 것을 권장함.
