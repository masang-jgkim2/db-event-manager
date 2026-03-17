# 나의 대시보드 권한 vs 쿼리 반영 프로세스 vs 이벤트 클릭 시 버튼 순서 비교

역할 권한 화면의 "나의 대시보드" 권한 목록, 쿼리 반영 워크플로, 이벤트 클릭 시 노출되는 액션 순서가 서로 매칭되는지 정리한 문서입니다.

---

## 1. 나의 대시보드 권한 (역할 권한 화면 순서)

`front/src/types/index.ts` 의 `ARR_PERMISSION_GROUPS` — **나의 대시보드** 그룹 순서:

| 순서 | 권한 코드 | 표시명 |
|------|-----------|--------|
| 1 | my_dashboard.view | 보기 |
| 2 | my_dashboard.detail | 상세 |
| 3 | my_dashboard.edit | 이벤트 수정 |
| 4 | my_dashboard.edit_any | 타인 이벤트 수정 |
| 5 | my_dashboard.request_confirm | 컨펌 요청 |
| 6 | my_dashboard.query_edit | 쿼리 수정 |
| 7 | my_dashboard.confirm | DBA 컨펌 |
| 8 | my_dashboard.request_qa | QA 반영 요청 |
| 9 | my_dashboard.execute_qa | QA 반영 실행 |
| 10 | my_dashboard.verify_qa | QA 확인 |
| 11 | my_dashboard.request_qa_rereq | QA 재반영 요청 |
| 12 | my_dashboard.request_live | LIVE 반영 요청 |
| 13 | my_dashboard.execute_live | LIVE 반영 실행 |
| 14 | my_dashboard.verify_live | LIVE 확인 |
| 15 | my_dashboard.request_live_rereq | LIVE 재반영 요청 |
| 16 | my_dashboard.hide | 숨기기/복원 |

---

## 2. 쿼리 반영 프로세스 (워크플로 상태 순서)

`backend` / `domain-event-instance.mdc` 기준 9단계 + 재요청:

| 순서 | 상태 | 다음 전이(들) |
|------|------|----------------|
| 1 | event_created | confirm_requested |
| 2 | confirm_requested | dba_confirmed |
| 3 | dba_confirmed | qa_requested 또는 live_requested(QA 스킵 시) |
| 4 | qa_requested | qa_deployed |
| 5 | qa_deployed | qa_verified / qa_requested(재요청) |
| 6 | qa_verified | live_requested / qa_requested(재요청) |
| 7 | live_requested | live_deployed |
| 8 | live_deployed | live_verified / live_requested(재요청) |
| 9 | live_verified | live_requested(재요청만) |

---

## 3. 이벤트 클릭 시 노출되는 액션 순서 (프로세스 순)

`MyDashboardPage.tsx` 의 `fnRenderActions` 렌더 순서:

| 공통/상태 | 노출 액션(버튼) | 필요한 권한 |
|-----------|-----------------|-------------|
| **공통** | 상세 | my_dashboard.detail |
| **공통** | 쿼리 수정 | my_dashboard.query_edit (confirm_requested, qa_requested, live_requested 만) |
| event_created | 수정 | my_dashboard.edit (본인 생성 시) |
| event_created | 컨펌 요청 | my_dashboard.request_confirm |
| confirm_requested | 컨펌 | my_dashboard.confirm |
| dba_confirmed | QA 반영 요청 / LIVE 반영 요청 | my_dashboard.request_qa / my_dashboard.request_live |
| qa_requested | QA 쿼리 실행 | my_dashboard.execute_qa 또는 instance.execute_qa |
| qa_deployed | QA확인, QA 재반영 요청 | my_dashboard.verify_qa, my_dashboard.request_qa |
| qa_verified | LIVE 반영 요청, QA 재반영 요청 | my_dashboard.request_live, my_dashboard.request_qa |
| live_requested | LIVE 쿼리 실행 | my_dashboard.execute_live 또는 instance.execute_live |
| live_deployed | LIVE확인, LIVE 재반영 요청 | my_dashboard.verify_live, my_dashboard.request_live |
| live_verified | LIVE 재반영 요청 | my_dashboard.request_live |

---

## 4. 매칭 비교 요약

### 4.1 권한 목록 vs 프로세스

- **권한 목록**은 “도메인 그룹” 순서: 보기/상세 → 수정 → 컨펌 흐름 → QA 그룹 → LIVE 그룹 → 숨기기.
- **프로세스**는 “이벤트가 거치는 상태” 순서: event_created → … → live_verified.
- 따라서 **목록 순서 자체는 프로세스 순서와 1:1로 같지 않음**.  
  대신 **프로세스 각 단계에서 쓰는 권한**이 권한 목록에 모두 포함되어 있음.

### 4.2 프로세스 단계별 ↔ 권한 매칭

| 프로세스 단계 | 사용 권한 | 권한 목록 내 존재 |
|---------------|-----------|-------------------|
| event_created | request_confirm, edit, edit_any | ✅ 모두 있음 |
| confirm_requested | confirm, query_edit | ✅ |
| dba_confirmed | request_qa, request_live | ✅ |
| qa_requested | execute_qa (또는 instance.execute_qa) | ✅ execute_qa 있음 |
| qa_deployed | verify_qa, request_qa(재요청) | ✅ (재요청은 request_qa로 처리, request_qa_rereq는 통계/표시용) |
| qa_verified | request_live, request_qa(재요청) | ✅ |
| live_requested | execute_live (또는 instance.execute_live) | ✅ execute_live 있음 |
| live_deployed | verify_live, request_live(재요청) | ✅ |
| live_verified | request_live(재요청) | ✅ |

→ **프로세스에서 쓰는 모든 권한이 “나의 대시보드” 권한 목록에 포함**되어 있으며, **이벤트 클릭 시 버튼 노출도 같은 권한으로 제어**되므로 **로직상 매칭됨**.

### 4.3 순서 차이 정리

| 구분 | 순서 기준 | 비고 |
|------|-----------|------|
| **권한 목록** | 보기/상세 → 수정 → 컨펌 → QA 블록 → LIVE 블록 → 숨기기 | 역할 권한 화면용 그룹핑 |
| **프로세스** | event_created → … → live_verified | 이벤트 상태 흐름 |
| **버튼 노출** | 상세/쿼리수정 → (상태별) 수정·컨펌 요청 → 컨펌 → QA 요청/실행/확인/재요청 → LIVE 요청/실행/확인/재요청 | 프로세스 순과 일치 |

- **이벤트 클릭 시 버튼 순서**는 **쿼리 반영 프로세스 순서와 일치**함.
- **권한 목록 순서**는 프로세스 순이 아니라 “보기·수정·컨펌·QA·LIVE” 블록 순이라 **프로세스와 1:1 순서 매칭은 아님**.  
  다만 **쓰이는 권한 집합**은 동일하고, **버튼–권한 매칭**도 일치함.

---

## 5. 결론

- **구조·로직**: 나의 대시보드 권한, 쿼리 반영 프로세스, 이벤트 클릭 시 액션은 **같은 권한 코드로 연결**되어 있으며, 프로세스 단계별로 필요한 권한이 모두 권한 목록에 있고 버튼 노출도 그에 맞게 동작함 → **매칭됨**.
- **순서**:  
  - **이벤트 클릭 시 버튼 순서** = **쿼리 반영 프로세스 순서**와 일치.  
  - **역할 권한 화면의 나의 대시보드 권한 순서** = 프로세스 순이 아니라 메뉴/그룹 순이므로, “프로세스와 순서까지 1:1 매칭”은 아님. 필요 시 권한 목록을 프로세스 순으로 재정렬하는 것은 선택 사항.
