# Cursor UI 스타일 — 컴포넌트 검토 (DQPM)

> 기준: Cursor IDE 라이트/다크 — 중성 회색 배경, 얇은 보더, 6–8px 라운드, 낮은 그림자, primary는 포인트만.
> 적용 완료: **1단계** `design-system.ts` · **2단계** `MainLayout.tsx` + `index.css` · **2b 정교화** 플랫 버튼/카드, 콘텐츠 패널, 세그먼트·페이지네이션, `data-dqpm-theme` 스크롤바

## Cursor 톤 요약 (구현 기준)

| 토큰 | 라이트 | 다크 |
|------|--------|------|
| Layout BG | `#F3F3F3` | `#1E1E1E` |
| Container | `#FFFFFF` | `#252526` |
| Sider | `#F7F7F7` | `#252526` |
| Border | `#E5E5E5` / `#E8E8E8` | `rgba(255,255,255,0.08–0.10)` |
| Primary 기본 | `#434343` (UI «Cursor IDE») | `#f54e00`는 «Cursor.com» — 웜 셸·[적용 목록](DESIGN-SYSTEM-CURSOR-COM-APPLIED.md) |

## 컴포넌트·페이지 매트릭스

| 파일 | Ant Design | Cursor 정합 | 비고 |
|------|------------|-------------|------|
| `App.tsx` | ConfigProvider | ✅ | `fnBuildDesignSystem` 주입 |
| `design-system.ts` | token/components | ✅ | `OBJ_CURSOR_NEUTRAL`, `objShell` |
| `MainLayout.tsx` | Layout, Menu | ✅ | 라이트 사이드바·48px 헤더 |
| `SettingsDrawer.tsx` | Drawer | 🟡 | 대부분 token; 색상 칩 선택 UI만 `#fff` 체크 |
| `NotificationBellDropdown.tsx` | Dropdown, List | ✅ | token 기반 |
| `AppTable.tsx` | Table | ✅ | token; bordered는 페이지 설정 따름 |
| `AuthCardLayout.tsx` | Card | 🟡 | Login과 동일 그라데이션 배경 |
| `LoginPage.tsx` | Card, Form | 🟡 | primary radial 배경 — Cursor Home과 유사, 카드는 OK |
| `RegisterPage.tsx` | Form | 🟡 | AuthCardLayout 경유 시 token |
| `RegisterSentPage.tsx` | Result | ✅ | `token.colorWarning` 경유 |
| `QueryEditDiffView.tsx` | Typography | ✅ | diff `fnCodeSurfaceStyle` + `dqpm-font-mono` |
| `QueryResultSetTable.tsx` | Table | ✅ | `bordered={false}` |
| `AppTable.tsx` | Table | ✅ | 기본 `bordered={false}` (호출부 override 가능) |
| `DashboardCardContent.tsx` | Card 내부 | 🟡 | DnD 스타일만; 카드 shell은 token |
| `InstanceCardLabelRows.tsx` | Tag, Text | ✅ | 레이아웃 위주 |
| `ApproveUserModal.tsx` | Modal | ✅ | 기본 Modal token |
| `RequestWithLongPressButton.tsx` | Button | ✅ | |
| `DashboardPage.tsx` | Card, Modal, Table | ✅ | 카드 아이콘 `fnDashboardCardSemanticColor` |
| `MyDashboardPage.tsx` | Card, Steps, Modal | ✅ | semanticColors + `fnCodeSurfaceStyle` (honeypot `#ccc` 2곳만) |
| `QueryPage.tsx` | Form, Card | ✅ | SQL `queryEditorTokens` + `dqpm-font-mono` |
| `EventPage.tsx` | Table, Modal | ✅ | 쿼리 템플릿 `fnCodeSurfaceStyle` |
| `ProductPage.tsx` | Table | ✅ | 삭제 아이콘 `token.colorError` |
| `UserPage.tsx` | Table, Tabs | ✅ | 온라인 점 `fnSemanticColor` |
| `DbConnectionPage.tsx` | Table, Tag | ✅ | 연결 점·테스트 결과 `fnSemanticColor` |
| `RolePage.tsx` | Form, Checkbox | ✅ | hex 거의 없음 |
| `ActivityPage.tsx` | Table, Tag | ✅ | |

범례: ✅ ConfigProvider만으로 충분 · 🟡 소수 하드코드/선택 조정 · 🔴 3단계 우선

## 3단계 권장 순서

1. **MyDashboardPage** — QA/LIVE/컨펌 버튼 → `token.colorPrimary` / `colorWarning` / 시맨틱 Tag
2. **DashboardPage** — `fnDashboardCardIcon` 색 → `ds.objColor` 또는 카테고리 맵 1곳
3. **공통** — `fnSemanticColor(strKind)` 유틸 (success/warning/error/info) → hex 제거
4. **Table** — `bordered={false}`, 헤더는 design-system Table token 유지
5. **Auth** — RegisterSent 아이콘만 `token.colorWarning`

## CRUD 목록 페이지 골격 (통일)

- **컴포넌트**: `front/src/components/CrudPageShell.tsx`
- **외곽**: DbConnection — `nodeIcon` + 제목 + `nodeDescription`(12px) + 우측 `nodeExtra`
- **내부**: User — `nodeToolbar`(Tabs 등) + `Card` 한 장 안에 테이블(활동은 필터+테이블+Pagination)
- **적용**: Product, Event, Role, User, DbConnection, Activity

## 목록 툴바 (`CrudListToolbar`)

| 패턴 | 컴포넌트 | `nodeLeft` | `nodeRight` | 페이지 |
|------|----------|------------|-------------|--------|
| 모드 전환 | `Segmented` | Segmented | — | 사용자 (건수 라벨) |
| 모드 전환 | `Segmented` | Segmented | Select·버튼 | 나의 대시보드 |
| 조회 필터 | `Form` | — | (Form 내부 Space) | 활동 — 툴바 대신 **세로 필터 Form** |

- **목록 모드 UI**: 사용자·나의 대시보드 → **Segmented** + `CrudListToolbar` (Card 밖)

## 신규 UI 작성 규칙

- 색: `theme.useToken()` 또는 `useDesignSystem().objColor`
- 워크플로 CTA: primary 단색 채움 지양 → Cursor는 **회색 selected + primary 텍스트/아이콘**
- 코드 블록: `#1e1e1e` / `#d4d4d4` (VS Code/Cursor 에디터) 유지 가능
- 신규 CRUD 목록: `CrudPageShell` 사용

## 검증

```powershell
cd front; npm run dev
# UI 설정 → Cursor primary / 다크 모드 / 기본값 초기화
```

## 일지

- **2026-05-29** 상세 목록·보류 항목: [`WORKLOG-2026-05-29.md`](./WORKLOG-2026-05-29.md)
