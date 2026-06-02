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
| Tag 팔레트 | `front/src/styles/tagPalette.ts` |
| React Context | `front/src/styles/DesignSystemContext.tsx` |
| UI 설정 | `front/src/stores/useThemeStore.ts` |
| Tag 컴포넌트 | `front/src/components/DqpmTag.tsx` |
| CRUD 골격 | `front/src/components/CrudPageShell.tsx` |

## Storybook

```bash
cd front
npm run storybook      # http://localhost:6006
npm run build-storybook
```

- 데코레이터: `.storybook/DqpmThemeDecorator.tsx` (앱과 동일 `ConfigProvider`)
- 툴바: **Theme** (light/dark), **Point** (Cursor IDE / Cursor.com)
- 스토리: `front/src/stories/dqpm/*`

## 포인트 컬러 프리셋

| UI 라벨 | hex | 셸 |
|---------|-----|-----|
| Cursor IDE | `#434343` | 중성 IDE |
| Cursor.com | `#f54e00` | 웜 캔버스 `#f7f7f4` |

## 신규 UI 규칙 (요약)

1. 색: `theme.useToken()` / `useDesignSystem()` — 페이지 hex 지양  
2. Tag: `<DqpmTag tone="…" />`  
3. 목록: `CrudPageShell` + `AppTable`  
4. AI 에이전트: UI 작업 전 `front/DESIGN.md` 참고
