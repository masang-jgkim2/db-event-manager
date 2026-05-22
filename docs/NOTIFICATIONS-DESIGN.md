# DQPM 인앱 알림 목록 — 설계

> 토스트 보조·이벤트 진행 요약. HTTP **활동 로그**·**Web Push**와 분리. (최종 갱신 2026-05-13)

---

## 1. 용어

| 구분 | 역할 |
|------|------|
| **토스트** | 작업 직후 1~3초 피드백 |
| **인앱 알림 목록** | 헤더 벨 — 재확인·딥링크 (최대 100건, 계정별 `localStorage`) |
| **활동 로그** | 서버 HTTP 감사 (`ActivityPage`) |
| **Web Push** | OS 알림 — `notification_subscription` + 전송 페이로드 (본문 DB 없음) |

---

## 2. 이벤트 인스턴스 진행 (9단계)

```
event_created → confirm_requested → dba_confirmed
  → qa_requested → qa_deployed → qa_verified
  → live_requested → live_deployed → live_verified
```

- 반영 범위 `['live']`만: `dba_confirmed` 후 `live_requested` 직행.
- 재요청: `qa_verified`→`qa_requested`, `live_deployed`/`live_verified`→`live_requested`.
- 단계 처리자: `objCreator`·`objConfirmer`·`objQaRequester`·`objQaDeployer`·`objQaVerifier`·`objLiveRequester`·`objLiveDeployer`·`objLiveVerifier`.

---

## 3. 알림 한 건 모델

| 필드 | 설명 |
|------|------|
| `strId` / `dtAt` / `bRead` | UUID, ISO 시각, 읽음 |
| `strLevel` | `success` \| `error` \| `warning` \| `info` |
| `strTitle` / `strBody?` | 제목·부가 설명 |
| `strRoute?` / `objQuery?` | 이동 (예: `/my-dashboard`, `nInstanceId`) |
| `strSource?` | `sse:instance_*`, `page:MyDashboard` 등 |

---

## 4. 수신 범위 (우선순위)

### 4.1 1순위 — 진행 관련 (구현)

**조건** (`fnShouldNotifyEventInstanceProgress`): 단계 **관여자**이거나, 현재 `strStatus`에서 **내 액션 권한**(`my_action` 필터와 동일)이 있는 인스턴스.

| 상태 | 액션 권한 예 |
|------|----------------|
| `event_created` | `my_dashboard.request_confirm` |
| `confirm_requested` | `my_dashboard.confirm` |
| `qa_requested` | `my_dashboard.execute_qa`, `instance.execute_qa` |
| `qa_deployed` | `my_dashboard.verify_qa`, `my_dashboard.request_qa_rereq`, `my_dashboard.request_live` |
| `live_requested` | `my_dashboard.execute_live`, `instance.execute_live` |
| `live_deployed` | `my_dashboard.verify_live`, `my_dashboard.request_live_rereq` |

**저장 항목 (1순위)**

| 트리거 | 제목 | 본문 | 레벨 | `strSource` |
|--------|------|------|------|-------------|
| SSE `instance_created` | 새 이벤트 | 이벤트명·상태 라벨 | info | `sse:instance_created` |
| SSE `instance_updated` | 내 이벤트 업데이트 | 이벤트명·상태 라벨 | info | `sse:instance_updated` |
| SSE `instance_status_changed` | 이벤트 상태 변경 | 이벤트명·(프로덕트)·상태 | info | `sse:instance_status_changed` |
| 나의 대시보드 API 실패 | 상태/수정/쿼리/삭제 실패 | 서버·권한 메시지 | error | `page:MyDashboard` |

- 생성자 본인에게 `instance_created` 목록 적재 없음.
- **영구 삭제**(`bPermanentlyRemoved`)·**`qa_verified`**: SSE로 목록만 갱신 — 인앱·Web Push·json 로컬 벨 없음. 삭제 API **실패**만 `page:MyDashboard` error.
- **숨기기**: 계정·브라우저 숨김 ID만 — 알림 없음.
- Web Push도 동일 **진행 대상** 사용자만 (`eventInstanceNotificationEligibility`).

### 4.2 2순위 — 기타 화면 (미연동)

쿼리 생성·DB 접속·사용자·역할·프로덕트 등 **error** 토스트 후보. 정책: **실패만 목록**, 성공은 토스트만.

### 4.3 제외

활동 로그 복사, SQL·스택, 무관 타인 이벤트 열람용 요약, 서버 알림 본문 테이블(미도입), 영구 삭제 성공, `qa_verified` 갱신, 숨기기.

---

## 5. 저장·UI

| 단계 | 위치 | 비고 |
|------|------|------|
| 1 | 프론트 `localStorage` | `DATA_STORE=json` — 기기·브라우저별 |
| 2 | MySQL `user_notification` | `DATA_STORE=mysql` — 계정별 최근 100건, 로그인 pull·읽음 PATCH |
| — | MySQL `notification_subscription` | Web Push 구독(endpoint·키), 본문 DB 없음 |

- UI: `MainLayout` `NotificationBellDropdown` — 배지, 읽음 PATCH·딥링크. **미읽음:** `colorFillAlter` 배경 + 왼쪽 primary 점(8px), 제목 `strong`; **읽음:** 동일 너비 여백으로 정렬, `title="미읽음"` 툴팁. 선택/호버는 기존 primary 배경·inset 우선. `sse:instance_*`는 `nInstanceId`당 최신 1건만 표시(저장은 건별).
- `/notifications` 전용 페이지: 후순위.

---

## 6. 정책 (확정)

- 토스트: 성공만 / 실패는 토스트+목록(1순위 진행 실패).
- 수신: 로그인 `nUserId`; 게스트 목록 없음.
- 전용 메뉴·`TPermission` 없음 (헤더 공통).

---

## 7. 구현 파일

- `front/src/utils/eventInstanceListFilter.ts` — 관여·`my_action`·`fnShouldNotifyEventInstanceProgress`
- `front/src/utils/notificationHelpers.ts`, `front/src/hooks/useEventStream.ts`, `front/src/services/notificationSync.ts`
- `front/src/pages/MyDashboardPage.tsx` — `fnNotifyError`
- `backend/src/services/eventInstanceNotificationEligibility.ts`, `inAppNotificationNotifier.ts`, `webPushNotifier.ts`
- `backend/src/data/userNotifications.ts`, `notificationSubscriptions.ts` — mysql `user_notification` / `notification_subscription`

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-30 | 초안 |
| 2026-05-11 | 1순위 진행 알림·저장 항목 표·수신 조건 확정, Web Push 정렬 |
| 2026-05-12 | mysql 인앱 `user_notification`·구독 `notification_subscription`·API/SSE 동기화 |
| 2026-05-12 | `qa_deployed`/`live_deployed` my_action·벨 `nInstanceId` 접기·영구 삭제·`qa_verified`·숨기기 알림 제외 |
| 2026-05-13 | 벨 드롭다운 읽음/미읽음 시각 구분(배경·왼쪽 점·정렬) 문서 반영 |
