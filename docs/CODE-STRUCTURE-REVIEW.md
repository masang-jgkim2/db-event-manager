# 코드 구조 검토 — 중복·반복·개발→테스트

전체 코드 구조, 중복/반복 패턴, 테스트 위치·커버리지를 정리한 문서입니다.

---

## 1. 구조 요약

| 영역 | 경로 | 주요 내용 |
|------|------|-----------|
| **백엔드** | `backend/src/` | controllers, routes, middleware, services, data(인메모리), repositories, db, types |
| **프론트** | `front/src/` | api, pages, components, stores, hooks, types |
| **테스트** | `backend/src/__tests__/api.test.ts` | API 통합 테스트 (supertest) |
| **E2E** | `front/e2e/*.spec.ts` | auth, navigation, products (Playwright) |

- **공통 테이블**: `AppTable.tsx` 한 곳에서 사용. 중복 테이블 구현 없음.
- **타입**: 백엔드·프론트 각각 `types/index.ts`. 권한·유저·역할 등 일부 타입이 양쪽에 중복 정의.

---

## 2. 중복 코드

### 2.1 프론트 API — `fnCatchApiError` 동일 로직 반복

**위치**: `userApi.ts`, `roleApi.ts`, `productApi.ts`, `eventApi.ts` (각 파일 상단에 동일 함수)

```ts
const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};
```

- `dbConnectionApi.ts`, `eventInstanceApi.ts`에는 동일 로직이 try/catch 안에 인라인으로 있음.
- **권장**: `api/requestHelpers.ts` 등에 `fnCatchApiError` 한 번만 정의하고 각 api에서 import.

---

### 2.2 백엔드 컨트롤러 — 404 조회 패턴

**위치**: product, event, dbConnection, user, role 등 컨트롤러

- 공통 패턴: `const nId = Number(req.params.id)` → `arr*.findIndex(...)` → `if (nIndex === -1) res.status(404).json({ bSuccess: false, strMessage: '...' }); return;`
- **권장**: `middleware/findEntity.ts` 같은 “find or 404” 헬퍼 하나 두고, 리소스별 배열·메시지만 넘겨서 재사용 (선택).

---

### 2.3 타입 — 백엔드·프론트 중복

**중복 정의 예**: `TPermission`, `IRole`, `IUser`, `ILoginRequest`, `IDbConnection`, `TDeployScope` 등

- 백엔드: `backend/src/types/index.ts`
- 프론트: `front/src/types/index.ts`
- **권장**: 단기에는 유지해도 됨. 장기적으로는 공통 패키지(`shared/types`) 또는 OpenAPI/코드생성으로 한쪽 기준 통일 검토.

---

## 3. 반복 구조 (패턴)

### 3.1 백엔드 라우트 — CRUD + 권한

- **패턴**: `authMiddleware` → `fnRequireAnyPermission('*.view')` → GET `/` → POST `/` → PUT `/:id` → DELETE `/:id`. 리소스·권한명만 다름.
- **파일**: `userRoutes`, `roleRoutes`, `productRoutes`, `eventRoutes`, `dbConnectionRoutes`
- **비고**: 현재 구조로도 읽기 쉬움. “라우트 팩토리”는 도입 시 오히려 복잡해질 수 있어 선택 사항.

---

### 3.2 프론트 목록+폼 페이지

- **패턴**: 권한 체크(`fnHasPermission`) → `fnLoad`(useEffect) → 테이블(AppTable) → “추가” 버튼(권한) → Modal(Form) add/edit → Popconfirm 삭제 → 저장 후 `messageApi` + `fnLoad`
- **파일**: `ProductPage`, `EventPage`, `RolePage`, `UserPage`, `DbConnectionPage`
- **비고**: 구조는 동일하나 필드·API·컬럼이 달라서, 지금 단계에서 무리하게 “CrudPage” 하나로 묶기보다는, **공통 훅**(`useCrudList`, `usePermissionButtons`) 정도만 추출하는 편이 현실적.

---

### 3.3 태그 색상 맵

- **패턴**: `Record<string, string>` 형태로 페이지별 정의 (예: `objDbTypeColor`, `OBJ_KIND_COLOR`, `OBJ_ENV_COLOR`).
- **권장**: `front/src/constants/tagColors.ts` 같은 한 파일로 모아서 import만 하면 재사용·일관성 확보 가능 (선택).

---

## 4. 개발 → 테스트 흐름

### 4.1 테스트 위치·역할

| 구분 | 파일 | 내용 |
|------|------|------|
| **API 테스트** | `backend/src/__tests__/api.test.ts` | health, 로그인(역할별), RBAC(메뉴/API 403), event-instance 생성/수정/실행 등 |
| **E2E** | `front/e2e/auth.spec.ts` | 로그인 성공/실패, 로그아웃 |
| **E2E** | `front/e2e/navigation.spec.ts` | 로그인 후 메뉴 클릭 → 대시보드, 프로덕트, 이벤트 템플릿, 나의 대시보드 등 URL·화면 |
| **E2E** | `front/e2e/products.spec.ts` | 프로덕트 페이지, “새로운 프로덕트” 모달 열기/닫기 |

### 4.2 실행 방법

```bash
# 백엔드 API 테스트
cd backend && npm test

# API 테스트만 (특정 파일)
npm run test:api

# E2E (프론트, Playwright)
cd front && npx playwright test
```

### 4.3 커버리지 갭

| 영역 | 현재 | 비고 |
|------|------|------|
| **백엔드** | API 통합 테스트 1개 파일 | 컨트롤러/서비스/레포 단위 테스트 없음. API 테스트로 주요 흐름 커버 |
| **프론트** | E2E 3개 스펙 | 단위/컴포넌트 테스트 없음. 로그인·메뉴·프로덕트 모달만 커버 |
| **나의 대시보드** | API 테스트에서 event-instance 일부 | E2E에서는 navigation만; 대시보드 내 버튼·상태 전이 E2E 없음 |
| **역할/사용자/이벤트 템플릿/DB접속** | API 테스트에서 403·목록 확인 | E2E는 메뉴 이동만; 각 페이지 CRUD E2E 없음 |

- **개발 후 확인**: 로컬에서 `backend` npm test + `front` playwright test 실행하면 “개발 → 테스트” 흐름은 동작함.
- **보강 시**: 나의 대시보드(상태 전이, 실행 버튼), 역할/사용자 CRUD 등 중요 시나리오를 E2E에 추가하면 안정성 확보에 유리함.

---

## 5. 정리 및 권장

### 5.1 중복 제거 (우선 적용 권장)

1. **프론트 `fnCatchApiError`**: 한 파일(`api/requestHelpers.ts`)에 두고 모든 api에서 import.
2. **(선택)** 태그 색상: `constants/tagColors.ts`로 모으기.

### 5.2 반복 구조

- 라우트·목록 페이지 패턴은 현재도 읽기 쉬우므로, **당장 리팩터 필수는 아님**. 필요 시 공통 훅/헬퍼만 단계적으로 도입.
- 백엔드 “find or 404” 헬퍼는 도입 시 컨트롤러 코드가 짧아져 유지보수에 도움됨 (선택).

### 5.3 테스트

- **현재**: 개발 후 `backend` npm test + `front` playwright test 로 회귀 확인 가능.
- **보강**: E2E에 “나의 대시보드에서 이벤트 선택·상태 전이/실행”, “역할/사용자 CRUD” 시나리오 추가 시 품질·리팩터 시 자신감 상승.

위 항목부터 적용하면 중복 감소와 “개발 → 테스트” 흐름이 더 명확해집니다.
