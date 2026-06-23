# E2E 테스트 (Playwright)

브라우저에서 로그인·메뉴·버튼을 누르는 **사람형 테스트**입니다.

> **페이지별 전체 시나리오·로드맵**: [docs/E2E-PAGE-TEST-PLAN.md](../docs/E2E-PAGE-TEST-PLAN.md) (통합 기준 문서)  
> **ID·풀·probe 상세**: [HEADED-TEST-CATALOG.md](./HEADED-TEST-CATALOG.md)  
> **수동 풀 플로우**: [MANUAL-FULL-WORKFLOW.md](./MANUAL-FULL-WORKFLOW.md)

## 빠른 실행

```powershell
# 사람형 통합 (smoke + 생성~LIVE~삭제) — 서버 자동 기동
.\scripts\run-e2e.ps1 -Profile human -WithServers

# 전체 playwright (레거시)
.\scripts\run-e2e-with-servers.ps1

# smoke만 (~1분, PR·기능 수정 후)
cd front
npm run test:e2e:smoke
```

| 명령 | 용도 |
|------|------|
| `.\scripts\run-e2e.ps1 -Profile human -WithServers` | **통합 사람형** — smoke + 7단계 + 삭제 |
| `npm run test:e2e:smoke` | `@smoke` — CI·일상 회귀 |
| `npm run test:e2e:workflow` | E-02~E-10 + **E-X3 삭제** (시드 필요) |
| `npm run test:e2e:human` | smoke + workflow (서버 기동됨 가정) |
| `npm run test:e2e:smoke:headed` | smoke + 브라우저 창 |
| `npm run test:e2e:ui` | UI 모드 — 수동 체크리스트 병행 |

삭제 스킵: `E2E_SKIP_DELETE=1`

## 서버·계정

1. 백엔드 `:4000`, 프론트 `:5173` (또는 `PLAYWRIGHT_BASE_URL`)
2. 계정: `admin`/`admin123`, `dba01`/`dba01`, `gm01`/`gm01` — `E2E_*` env로 덮어쓰기 (`README` 하단·`.env.e2e.local`)

## Cursor 에이전트

기능 수정 후 헤드리스 smoke: `.cursor/rules/browser-e2e-smoke.mdc` · [docs/E2E-PAGE-TEST-PLAN.md](../docs/E2E-PAGE-TEST-PLAN.md)

## spec ↔ 페이지 (요약)

| spec | 페이지·흐름 |
|------|-------------|
| `auth.spec.ts` | `/login` |
| `register-*.spec.ts` | `/register`, `/users` 승인 |
| `navigation*.spec.ts` | 메뉴 진입·권한별 노출 |
| `products.spec.ts` | `/products` |
| `workflow-qa-live.spec.ts` | `/query` → `/my-dashboard` 7단계 + **삭제** |
| `my-dashboard-dba.spec.ts` | `/my-dashboard` DBA·상세 |
| `result-ui.spec.ts` | 실행 결과 UI |
| `theme-cursor-site.spec.ts` | 레이아웃·테마 |

전체 매트릭스: [E2E-PAGE-TEST-PLAN.md](../docs/E2E-PAGE-TEST-PLAN.md)
