# Generative UI 패턴 (React + Ant Design)

> 이 저장소에서 **안전하게** “서버/LLM이 UI를 조립한다”는 아이디어를 쓰는 방법을 정리한다.  
> 구현 참조: `front/src/types/generativeUi.ts`, `front/src/components/GenerativeUiRenderer.tsx`

---

## 1. 핵심 아이디어

1. **UI는 JSON(또는 동등한 스펙)** 으로만 기술한다.
2. **프론트는 화이트리스트 렌더러**만 둔다 — `strType` → 미리 등록한 Ant Design 컴포넌트 조합.
3. **임의 JSX·스크립트·HTML 문자열 실행은 금지** (`dangerouslySetInnerHTML`, `eval` 등).

이렇게 하면 LLM이 “무엇을 보여줄지”만 결정하고, **어떻게 그릴지**는 앱이 통제한다.

---

## 2. 데이터 흐름 (권장)

```
[사용자 입력 / 대시보드 컨텍스트]
    → (선택) LLM이 IUiSpec 형태 JSON 제안
    → 백엔드에서 Zod 등으로 스키마 검증 · 크기 제한 · 필드 화이트리스트
    → 프론트는 검증된 객체만 GenerativeUiRenderer에 전달
```

- **백엔드 검증**이 없으면, 최소한 프론트에서 **런타임 파서(Zod 등)** 로 `arrBlocks` 길이·키 이름·셀 타입을 제한한다.
- **테이블 셀**은 `string | number | boolean | null` 만 허용(본 프로젝트 타입). HTML 넣지 않는다.

---

## 3. 스펙 버전 (`IUiSpec`)

| 필드 | 설명 |
|------|------|
| `strSchemaVersion` | 현재 `'1'` — 브레이킹 변경 시 올림 |
| `arrBlocks` | 순서대로 그릴 블록 배열 |

### 블록 타입 (`TUiBlock`)

| `strType` | 용도 | AntD 대응 |
|-----------|------|-----------|
| `statistic` | 단일 지표 | `Statistic` + `Card` |
| `table` | 집계 표 | `Table` + `Card` |
| `alert` | 안내·경고 | `Alert` |
| `text_plain` | 여러 줄 텍스트(마크다운 아님) | `Typography.Text` (`pre-wrap`) |

추가 타입(차트, `Tabs`, 대시보드 전용 `instance_list` 요약 등)은 **같은 방식으로 union에 케이스 추가**하면 된다.

---

## 4. DB Event Manager에 붙이는 예

- **대시보드 통계**: 백엔드 또는 BFF가 `groupBy` 집계 후 `table` 블록 하나로 내려주기.
- **자연어 질의(미래)**: LLM 출력을 **반드시** `IUiSpec` JSON으로 강제(함수 호출 / structured output), 파싱 실패 시 `alert` 블록만 표시.
- **나의 대시보드 위젯**: `docs/DASHBOARD-LAYOUT-SPEC.md`의 위젯 타입과 **별도**로, “동적 패널”만 Generative UI로 두고 나머지는 기존 고정 위젯 유지 — 점진 도입에 유리.

---

## 5. 보안 체크리스트

- [ ] 스펙 최대 블록 수·테이블 최대 행 수 제한
- [ ] 알 수 없는 `strType` → 렌더 거부 + 로그
- [ ] 사용자 입력을 그대로 `strBody`에 넣지 말 것(이스케이프는 Text 노드로 충분하나, 정책상 길이 제한)
- [ ] 마크다운이 필요하면 **별도 의존성(react-markdown 등) + sanitize** 후 단계적 도입

---

## 6. 로컬에서 샘플 보기

샘플 스펙은 `front/src/constants/generativeUiSample.ts` 의 `OBJ_SAMPLE_UI_SPEC` 을 사용한다. 개발 중 임시로 어떤 페이지에:

```tsx
import { GenerativeUiRenderer } from '../components/GenerativeUiRenderer';
import { OBJ_SAMPLE_UI_SPEC } from '../constants/generativeUiSample';

<GenerativeUiRenderer objSpec={OBJ_SAMPLE_UI_SPEC} />
```

를 넣어 동작을 확인할 수 있다(배포 전 제거 또는 플래그 처리).

---

## 7. 관련 문서

- `docs/DASHBOARD-STATS-FEASIBILITY.md` — 집계 데이터를 어디서 만들지와의 연계
- `docs/DASHBOARD-LAYOUT-SPEC.md` — 고정 위젯 레이아웃(Generative UI와 병행 가능)
