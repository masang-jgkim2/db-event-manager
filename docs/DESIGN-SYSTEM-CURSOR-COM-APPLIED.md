# cursor.com 디자인 시스템 — DQPM 적용 목록

> 기준: [cursor.com](https://cursor.com/) 공개 톤·서드파티 토큰 정리.  
> 적용 범위: **디자인 시스템 레이어** (`design-system`, `cursorSiteTokens`, 전역 CSS, UI 설정 프리셋).  
> 페이지별 hex 제거(MyDashboard 등)는 별도 3단계.

## 활성화 방법

1. **UI 설정** → 포인트 컬러 **「Cursor.com」** (`#f54e00`)
2. **라이트 모드** (다크는 IDE 다크 셸 유지)
3. → `data-dqpm-shell="cursor-site"` + 웜 셸·오렌지 링크·크림 primary 버튼

**「Cursor IDE」** (`#434343`) 선택 시 기존 중성 셸·회색 primary 유지.

---

## 적용 완료

| # | 영역 | cursor.com | DQPM 구현 |
|---|------|------------|-----------|
| 1 | **액센트 컬러** | `#f54e00` | `STR_CURSOR_SITE_ACCENT` · 프리셋 **Cursor.com** |
| 2 | **액센트 hover** | `#d04200` | `STR_CURSOR_SITE_ACCENT_HOVER` · 링크 hover |
| 3 | **캔버스 배경** | `#f7f7f4` | 라이트 layout/sider/header `OBJ_CURSOR_SITE_SHELL` |
| 4 | **본문 잉크** | `#26251e` | `colorText` · 헤더 텍스트 |
| 5 | **보조 텍스트** | ~55% ink | `colorTextSecondary` `rgba(38,37,30,0.55)` |
| 6 | **보더** | ~10% ink | `strBorder` / `--dqpm-border` warm |
| 7 | **세그먼트 트랙** | `#e6e5e0` | `strSegmentedTrack` Pebble |
| 8 | **링크** | 오렌지 | `colorLink` / `colorLinkHover` |
| 9 | **메뉴 선택** | (액센트 틴트) | primary mix 배경 + **오렌지 선택 글자** |
| 10 | **primary 버튼** | 크림+오렌지 아웃라인 | Ant Button token + `index.css` `.ant-btn-primary` |
| 11 | **Tag 팔레트** | 단일 accent 계열 | 기존 `objTag` + `DqpmTag` (primary 10단계) |
| 12 | **UI 폰트** | CursorGothic | **Inter** + Noto Sans KR (`index.html` Google Fonts) |
| 13 | **코드 폰트** | Berkeley Mono | **JetBrains Mono** (`STR_FONT_MONO`, DS export) |
| 14 | **모서리** | 8px CTA | 기존 `borderRadius: 8` 유지 |
| 15 | **토큰 파일** | — | `front/src/styles/cursorSiteTokens.ts` |
| 16 | **DS 플래그** | — | `IDesignSystem.bCursorSiteShell` |

### 관련 파일

- `front/src/styles/cursorSiteTokens.ts` — 사이트 hex·셸·폰트 스택
- `front/src/styles/design-system.ts` — Ant `token` / `components` 매핑
- `front/src/stores/useThemeStore.ts` — 프리셋 라벨 `Cursor IDE` / `Cursor.com`
- `front/src/index.css` — cursor-site primary 버튼·CSS 변수
- `front/index.html` — Inter / JetBrains Mono / Noto Sans KR

---

## 미적용 (의도적·추후)

| 항목 | 사유 |
|------|------|
| **CursorGothic / jjannon / Berkeley Mono 원본** | 라이선스·배포 불가 → Inter / JetBrains Mono 대체 |
| **cursor.com CSS/폰트 핫링크** | ToS·URL 변경 리스크 |
| **히어로·데모·타임라인 pill (마케팅)** | CRUD 범위 밖 · 워크플로 Steps/이력은 `workflowTimelineColors` 적용 |
| **다크 모드 웜 셸** | 사이트는 라이트 중심 → 다크는 IDE `#1E1E1E` 유지 |
| **전 페이지 hex 제거** | 대시보드·2차 페이지 완료 — honeypot `#ccc`만 잔존 |
| **코드 블록 전역 mono** | `queryEditorTokens.ts` (`fnCodeSurfaceStyle`, `STR_CODE_BLOCK_CLASS`) |

---

## 검증 체크리스트

- [x] E2E `theme-cursor-site.spec.ts` — Cursor.com → `data-dqpm-shell=cursor-site`, IDE → `ide`
- [ ] 설정 → **Cursor.com** + 라이트 → 배경 `#f7f7f4`에 가깝게 보이는지 (수동)
- [ ] 사이드바 메뉴 선택 — 연한 오렌지 틴트·오렌지 글자 (수동)
- [ ] primary 버튼 — 크림 + 오렌지 테두리 (수동)
- [ ] 링크·Tag 포인트 팔레트 (수동 / Storybook)
- [ ] 다크 모드 레이아웃 (수동)

---

## 참고

- `docs/CURSOR-UI-AUDIT.md` — IDE 톤·컴포넌트 매트릭스
- 이전 대화: cursor.com vs «Cursor IDE» 프리셋 구분
