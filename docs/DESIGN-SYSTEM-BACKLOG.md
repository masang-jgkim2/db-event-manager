# 디자인 시스템 백로그

[getdesign Cursor](https://getdesign.md/cursor/design-md) 대비 DQPM 개선 작업 목록.

## 완료

- [x] DqpmTag · cursor.com 셸 · Storybook
- [x] 타이포 역할 (`typographyTokens.ts`, CrudPageShell, Ant token)
- [x] `semanticColors.ts` · Dashboard/MyDashboard/2차 페이지 hex
- [x] Query SQL `queryEditorTokens.ts` · `fnCodeSurfaceStyle` / `fnSqlEditorReadonlyStyle`
- [x] MyDashboard · Event · QueryEditDiffView mono 통일
- [x] `vitest.shims.d.ts` 제거

## 진행 중 / 남음

- [x] Storybook: Menu/Table/SemanticColors, assets 정리, 데코레이터 타이포 CSS
- [x] `frontend-patterns.mdc` — 디자인 시스템 절
- [x] Table `bordered={false}` — AppTable 기본, QueryResultSetTable
- [ ] E2E: Cursor.com 프리셋 스모크 (선택)
- [ ] 다크 모드 cursor-site 웜 셸 (보류)
- [ ] `display-mega` 마케팅 타이포 (범위 밖)

## 검증

```bash
cd front && npm run build && npm run build-storybook
```
