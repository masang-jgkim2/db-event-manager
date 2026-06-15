# DQPM 디자인 시스템

운영 앱(DQPM) UI/UX의 **단일 진입점**입니다. Figma 패키지는 없고, **코드 토큰 + Storybook + DESIGN.md** 로 관리합니다.

## 참조 (Cursor)

| 자료 | 경로 |
|------|------|
| getdesign Cursor 분석 | [front/DESIGN.md](../front/DESIGN.md) — `cd front && npx getdesign@latest add cursor` |
| cursor.com 적용 목록 | [DESIGN-SYSTEM-CURSOR-COM-APPLIED.md](./DESIGN-SYSTEM-CURSOR-COM-APPLIED.md) |
| 컴포넌트 정합 감사 | [CURSOR-UI-AUDIT.md](./CURSOR-UI-AUDIT.md) |

## 코드

| 역할 | 파일 |
|------|------|
| 토큰 빌더 | `front/src/styles/design-system.ts` |
| cursor.com hex | `front/src/styles/cursorSiteTokens.ts` |
| 시맨틱 색 | `front/src/styles/semanticColors.ts` |
| SQL·코드 블록 | `front/src/styles/queryEditorTokens.ts` |
| 워크플로 타임라인 색 | `front/src/styles/workflowTimelineColors.ts` |
| 타이포 역할 | `front/src/styles/typographyTokens.ts` · `typographyCss.ts` |
| Tag 팔레트 | `front/src/styles/tagPalette.ts` |
| React Context | `front/src/styles/DesignSystemContext.tsx` |
| UI 설정 | `front/src/stores/useThemeStore.ts` |
| Tag 컴포넌트 | `front/src/components/DqpmTag.tsx` |
| CRUD 골격 | `front/src/components/CrudPageShell.tsx` · `CrudListToolbar.tsx` |
| 앱 셸 | `front/src/components/MainLayout.tsx` · `SettingsDrawer.tsx` |
| 전역 셸 CSS | `front/src/index.css` — `.dqpm-layout-sider`, `.dqpm-crud-page-*`, cursor-site primary |
| 상태 아이콘 | `front/src/constants/statusIcons.tsx` |

## Storybook

```bash
cd front
npm run storybook      # http://localhost:6006
npm run build-storybook
```

Windows: repo 루트 `start.bat storybook` (또는 `sb` / `all`) — 백엔드·프론트와 함께 Storybook 창 실행. 종료는 `stop.bat` / `kill-dev-ports.bat`(6006 포함).

- 아이콘 카탈로그: http://localhost:6006/?path=/story/dqpm-icons--app-catalog (`TeamOutlined` 등 앱 사용 목록)
- 데코레이터: `.storybook/DqpmThemeDecorator.tsx` — `fnBuildDesignSystem` + `DesignSystemContext` + `fnApplyTypographyCssVars` (앱 `App.tsx`와 동일 파이프)
- 툴바: **Theme** (light/dark), **Point** (Cursor IDE / Cursor.com / 블루)
- 소개: `front/src/stories/Introduction.mdx`
- 스토리 (`front/src/stories/dqpm/`):

| 스토리 | 앱과 공유하는 소스 |
|--------|-------------------|
| FoundationColors | `cursorSiteTokens.ts`, `design-system.ts` |
| Typography | `typographyTokens.ts`, `useDesignSystem()` |
| SemanticColors | `semanticColors.ts` |
| DqpmTag · ProductNameTag | `DqpmTag.tsx`, `ProductNameTag.tsx`, `tagPalette.ts` |
| Icons | `constants/statusIcons.tsx`, `MainLayout` 메뉴·헤더 (`@ant-design/icons`) |
| Buttons | Ant token (`design-system.ts`) |
| Menu | `MainLayout` SubMenu · 펼침/접힘(`inlineCollapsed`) · `menuStoryItems.tsx` |
| CrudPageShell | `CrudPageShell.tsx` · Statistic 카드 행 샘플 |
| SettingsDrawer | `useThemeStore` 포인트 3종 · `ARR_PRIMARY_COLORS` |
| Table | `DqpmTag` 등 (plain Ant `Table`; `AppTable` 스토리는 보류) |
| CodeSurface | `queryEditorTokens.ts` |
| WorkflowTimeline | `workflowTimelineColors.ts`, `OBJ_CURSOR_TIMELINE` |

- 백로그: [DESIGN-SYSTEM-BACKLOG.md](./DESIGN-SYSTEM-BACKLOG.md)

## Storybook과 앱 동기화

**원칙:** 디자인 시스템의 “진실”은 `front/src/styles/*`와 공용 컴포넌트입니다. Storybook은 그걸 **미리보기**할 뿐, 별도 테마를 갖지 않습니다.

### 함께 바뀜 (토큰·컴포넌트 수정 → Storybook + 모든 페이지)

| 변경 위치 | 반영 범위 |
|-----------|-----------|
| `design-system.ts`, `cursorSiteTokens.ts` | Ant `ConfigProvider` token, cursor-site 셸, 버튼·테이블·메뉴 색 |
| `semanticColors.ts`, `tagPalette.ts` | 대시보드·태그·시맨틱 버튼 |
| `typographyTokens.ts` / `typographyCss.ts` | CRUD 제목·본문·CSS 변수 |
| `queryEditorTokens.ts` | SQL 블록 (MyDashboard, Event, Query, diff) |
| `workflowTimelineColors.ts` | 나의 대시보드 Steps·이력 Timeline |
| `DqpmTag.tsx`, `ProductNameTag.tsx` | 태그가 쓰이는 모든 화면 |

앱과 Storybook 모두 `fnBuildDesignSystem(strPrimary, bDark, nFontSize)` → `DesignSystemContext` → `ConfigProvider` 순서입니다.

### Storybook만 바뀜 (운영 페이지 무관)

| 변경 위치 | 이유 |
|-----------|------|
| `*.stories.tsx` 레이아웃·목업 데이터·문구 | 스토리 전용 UI |
| `Introduction.mdx` | 문서 |

### 앱만 바뀜 (Storybook에 없거나 다름)

| 항목 | 차이 |
|------|------|
| `useThemeStore` 글자 크기·compact·재미 모드 | Storybook 데코레이터는 **14px 고정**, UI 설정 드로어 없음 |
| `AppTable` (열 드래그·너비 저장) | Table 스토리는 plain Ant `Table` |
| MyDashboard 워크플로 버튼·Stepper·모달 | WorkflowTimeline은 색만 |
| 로그인 `AuthCardLayout` 그라데이션 | 브랜드 전용, DS 토큰 밖 |

### 검증 방법

1. Storybook에서 **Point → Cursor.com**, **Theme → Dark** 전환 후 Foundation / Buttons 확인  
2. 앱 **UI 설정**에서 동일 조합 선택 → 배경·Primary·태그가 같은지 비교  
3. 토큰 hex 변경 후 `npm run build-storybook` + `npm run build` — 타입·빌드 깨짐 없는지 확인  

토큰을 바꿀 때는 **스토리 파일이 아니라 `src/styles/*`(또는 공용 컴포넌트)** 를 수정해야 페이지에 반영됩니다.

## 포인트 컬러 프리셋 (UI 설정 3종)

| UI 라벨 | hex | 셸 |
|---------|-----|-----|
| Cursor IDE | `#434343` | 중성 IDE |
| Cursor.com | `#f54e00` | 웜 캔버스 `#f7f7f4` |
| 블루 | `#1677ff` | IDE 톤 (Ant 기본 primary) |

구 팔레트(인디고·마젠타 등) 저장값은 로드 시 **Cursor IDE**로 보정 (`useThemeStore` migrate v2).

## 타이포그래피 (getdesign Cursor)

| DESIGN.md 역할 | 용도 | 코드 |
|----------------|------|------|
| `pageTitle` (22px) | CRUD 페이지 제목 | `CrudPageShell` · `fontSizeHeading4` |
| `titleMd` (18px) | Card 헤더 | Ant `Card.headerFontSize` |
| `titleSm` (16px) | 사이드바 로고 | `objSider.nLogoFontSize` |
| `bodyMd` | 본문·메뉴·Input | `fontSize` token |
| `bodySm` | 테이블·Tag | `Table` / `Tag` |
| `caption` | 페이지 설명 | `CrudPageShell` 설명 |
| `captionUppercase` | 메뉴 그룹 | `objMenuGroup` |
| `code` | SQL·diff | `fnCodeSurfaceStyle` + `.dqpm-font-mono` |
| `button` / `navLink` | 버튼·메뉴 | Ant `Button` |

- 구현: `typographyTokens.ts` → `fnBuildTypographyRoles(nFontSize)` (UI 설정 글자 크기와 동기)
- CSS 변수: `typographyCss.ts` (`--dqpm-font-family`, `--dqpm-font-size-body` …)
- 헬퍼: `fnTypoStyle(role)` — 인라인 스타일
- 폰트: CursorGothic → **Inter** + Noto Sans KR · 코드 → **JetBrains Mono**

## 사이드바 (MainLayout)

- 메뉴는 Ant **`SubMenu`** (구 `type: 'group'` 은 접기 불가).
- 그룹: **이벤트** · **사용자** · **운영** — 각 `icon` + `fnRenderMenuSubmenuLabel` (텍스트만).
- `openKeys` / `onOpenChange` — 펼침 상태; 현재 경로 그룹은 자동 펼침.
- **접힘** (`inlineCollapsed`): 그룹 **아이콘만** 중앙 정렬 — `index.css` `.ant-menu-inline-collapsed` 규칙.
- Storybook: `DQPM/Menu` → SubMenu 펼침 · SubMenu 접힘.

## 통계 카드 (나의 대시보드 등)

- `Card bordered={false}` + `Statistic` — `valueStyle` **fontSize 22 · lineHeight 1.2** 통일.
- 시맨틱 숫자: `fnSemanticStatisticStyle(kind, token)` · 중립(전체): `token.colorText`.
- 제목 `styles={{ title: { minHeight: 22 } }}` — 카드 높이 흔들림 방지.
- Storybook: `DQPM/CrudPageShell` 샘플.

## 신규 UI 규칙 (요약)

1. 색: `theme.useToken()` / `useDesignSystem()` — 페이지 hex 지양  
2. 타이포: `useDesignSystem().objTypoRoles` + `fnTypoStyle` — px 하드코드 지양  
3. SQL/코드: `fnCodeSurfaceStyle(token)` · 읽기 전용 다크는 `fnSqlEditorReadonlyStyle`  
4. Tag: `<DqpmTag tone="…" />`  
5. 목록: `CrudPageShell` + `AppTable` — 페이지 제목에 `nodeIcon` (사이드 메뉴 아이콘과 맞춤)  
6. AI 에이전트: UI 작업 전 `front/DESIGN.md` 참고
