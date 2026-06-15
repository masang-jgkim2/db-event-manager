# 디자인 시스템 백로그

[getdesign Cursor](https://getdesign.md/cursor/design-md) 대비 DQPM 개선 작업 목록.

## 완료

- [x] DqpmTag · cursor.com 셸 · Storybook
- [x] 타이포 역할 (`typographyTokens.ts`, CrudPageShell, Ant token)
- [x] `semanticColors.ts` · Dashboard/MyDashboard/2차 페이지 hex
- [x] Query SQL `queryEditorTokens.ts` · `fnCodeSurfaceStyle` / `fnSqlEditorReadonlyStyle`
- [x] MyDashboard · Event · QueryEditDiffView mono 통일
- [x] `vitest.shims.d.ts` 제거
- [x] `frontend-patterns.mdc` — 디자인 시스템 절
- [x] Table `bordered={false}` — AppTable 기본, QueryResultSetTable
- [x] E2E: `theme-cursor-site.spec.ts` (@smoke)
- [x] 워크플로 타임라인 파스텔 — `workflowTimelineColors.ts` · Steps · 이력 Timeline

## Storybook (카탈로그)

- [x] Menu / Table / SemanticColors / CodeSurface / WorkflowTimeline / Icons
- [x] Menu — SubMenu 펼침·접힘 (`menuStoryItems.tsx`, `index.css` 연동)
- [x] CrudPageShell · SettingsDrawer (포인트 3종)
- [x] Storybook 툴바 Point — 블루 프리셋 · `preview.tsx` `index.css` import
- [x] `stories/assets` 미사용 파일 제거
- [x] `DESIGN-SYSTEM.md` — 사이드바 · 통계 카드 · 스토리 목록

## 보류 / 범위 밖

- [ ] 다크 모드 cursor-site 웜 셸
- [ ] `display-mega` 마케팅 타이포
- [ ] Storybook: `AppTable` (DnD·열 저장) 전용 스토리

## 검증

```bash
cd front && npm run build && npm run build-storybook
```
