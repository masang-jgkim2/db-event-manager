# 실시간 반영 방식 검토: 폴링 / SSE / WebSocket

> 작성일: 2026-03-10  
> 목적: 나의 대시보드의 **버튼·페이지 상태 실시간 반영** 로직을 위한 방식 비교. 현재는 **SSE**로 구현되어 있음.

---

## 1. 현재 구현 요약 (SSE)

### 1.1 흐름

```
[백엔드]
  - 상태 변경 시점: 인스턴스 생성·수정·상태 전이(PATCH)·쿼리 실행(POST execute) 후
  - eventInstanceController에서 fnBroadcastInstanceUpdate(objInstance) / fnBroadcastInstanceCreated(objInstance) 호출
  - sseBroadcaster: 유저별로 등록된 SSE 연결(Map<userId, Set<Response>>)에 event + data 전송

[프론트]
  - MainLayout 마운트 시 useEventStream() → GET /api/event-instances/stream?token=... (EventSource)
  - 수신 이벤트: connected, instance_created, instance_updated, instance_status_changed
  - useEventInstanceStore.fnHandleSseEvent(strEvent, objPayload)
    → instance_created: 목록에 신규 추가
    → instance_updated: 관여자에게 전체 인스턴스로 목록 갱신
    → instance_status_changed: 비관여자에게 nId/strStatus만 반영(가벼운 갱신)
  - arrInstances / arrAllInstances 갱신 → 테이블·카드·버튼(상태별 노출)이 자동 반영
```

### 1.2 브로드캐스트 호출 위치

| 위치 | 호출 함수 | 시점 |
|------|-----------|------|
| fnCreateInstance | fnBroadcastInstanceCreated | 인스턴스 생성 직후 (생성자 제외 전원에게) |
| fnUpdateStatus | fnBroadcastInstanceUpdate | 상태 전이(컨펌 요청, DBA 컨펌, QA/LIVE 요청·실행·확인 등) 직후 |
| fnUpdateInstance | fnBroadcastInstanceUpdate | 인스턴스 수정(이벤트 수정, 쿼리 수정) 직후 |
| fnExecuteAndDeploy | fnBroadcastInstanceUpdate | QA/LIVE 쿼리 실행 성공 후 상태 전이 직후 |

### 1.3 관여자 vs 비관여자

- **관여자**: 생성자·컨펌자·QA/LIVE 요청자·실행자·확인자 → `instance_updated` 이벤트로 **전체 인스턴스 객체** 전송 (상세·스테퍼 등에서 최신 데이터 필요).
- **비관여자**: 그 외 연결된 유저 → `instance_status_changed` 로 **nId, strStatus, strEventName, strProductName** 만 전송 (목록 상태·버튼 노출만 갱신, 트래픽 절약).

---

## 2. 방식 비교: 폴링 / SSE / WebSocket

실시간(준실시간) 반영을 위한 대표 세 가지 방식과 장단점.

### 2.1 폴링 (Polling)

**방식**: 클라이언트가 일정 간격(예: 5초, 10초)으로 `GET /api/event-instances` 등을 호출해 목록을 다시 받아와 화면을 갱신.

| 구분 | 내용 |
|------|------|
| **장점** | 구현 단순(기존 REST만 사용), 방화벽/프록시 이슈 거의 없음, 서버도 별도 푸시 로직 불필요. |
| **단점** | 주기만큼 지연 발생(5초 폴링이면 최대 5초 늦게 반영), 요청 횟수 많아지면 서버·네트워크 부하 증가, 실시간성 낮음. |
| **적합** | 변경 빈도가 낮고, 수 초 지연이 허용되는 경우. |

**롱 폴링(Long Polling)** 변형: 클라이언트가 요청을 보내면 서버는 “변경 있을 때까지” 응답을 미루고, 변경 시점에 응답. 다음 요청을 다시 보냄.  
- 장점: 폴링보다 반영이 빠름.  
- 단점: 연결을 오래 붙들어 서버 리소스·타임아웃 관리 필요, 구현이 폴링보다 복잡.

---

### 2.2 SSE (Server-Sent Events) — 현재 채택

**방식**: HTTP 연결을 한 번 열어 두고, 서버에서 이벤트(`event:` + `data:`)만 계속 푸시. 단방향(서버 → 클라이언트). `EventSource` API 사용.

| 구분 | 내용 |
|------|------|
| **장점** | HTTP 기반이라 방화벽/프록시 통과 용이, 브라우저 내장 `EventSource`로 구현 간단, 서버는 기존 Express Response만 유지·write, 재연결·이벤트 타입 분리 용이. |
| **단점** | 단방향만 지원(클라이언트→서버는 별도 HTTP 요청), 연결당 하나의 스트림. |
| **적합** | 서버가 “상태 변경 알림”만 푸시하면 되는 나의 대시보드 같은 UI(버튼·테이블·상태 반영)에 잘 맞음. |

현재 구조: 토큰을 쿼리스트링으로 넘기고, 30초마다 heartbeat 주석으로 프록시 타임아웃을 피함.

---

### 2.3 WebSocket

**방식**: TCP 위 전용 프로토콜(ws/wss). 한 번 핸드셰이크 후 **양방향** 통신. 서버가 푸시할 수도 있고, 클라이언트가 메시지를 보낼 수도 있음.

| 구분 | 내용 |
|------|------|
| **장점** | 양방향, 저지연, 한 연결로 다용도 메시지 주고받기 가능, 고빈도·대량 메시지에 유리. |
| **단점** | HTTP가 아니라 별도 프로토콜·프록시/방화벽 설정 이슈 가능, Express와 별도로 WebSocket 서버(또는 Socket.IO 등) 도입·연결·인증(JWT 등) 설계 필요. |
| **적합** | 채팅, 협업 편집, 게임 등 **양방향·고빈도**가 필요한 경우. “상태 변경 푸시만” 필요하면 SSE로 충분. |

---

## 3. 세 가지 요약 표

| 항목 | 폴링 | SSE | WebSocket |
|------|------|-----|-----------|
| **방향** | 클라이언트 주기적 요청 | 서버 → 클라이언트 | 양방향 |
| **프로토콜** | HTTP GET 반복 | HTTP (스트림 유지) | ws/wss |
| **실시간성** | 주기만큼 지연 | 변경 즉시 푸시 | 변경 즉시 푸시 |
| **구현 난이도** | 낮음 | 중간 (현재 구현됨) | 상대적으로 높음 |
| **서버 부하** | 요청 많으면 증가 | 연결 유지·이벤트만 전송 | 연결 유지·메시지 전송 |
| **방화벽/프록시** | 문제 적음 | HTTP라 보통 통과 | ws 업그레이드·설정 필요할 수 있음 |
| **현재 프로젝트** | 미사용 | ✅ 사용 중 (나의 대시보드 실시간 반영) | 미사용 |

---

## 4. 결론 및 유지 보수

- **현재**: 나의 대시보드의 버튼·페이지 상태 실시간 반영은 **SSE**로 구현되어 있으며, “상태 변경 시 서버가 한 번 푸시하면 클라이언트가 스토어를 갱신”하는 구조로 적절함.
- **폴링**: 구현은 쉽지만 지연·부하 때문에 실시간 반영 목적에는 비추.
- **WebSocket**: 양방향·고빈도가 필요해질 때 검토하면 되고, 지금 요구사항만으로는 SSE 유지가 합리적.
- **3번째로 기억하신 것**: 위 세 가지 중 하나는 **폴링(또는 롱 폴링)** 일 가능성이 높음. 실시간 반영 검토 시 흔히 “폴링 / SSE / WebSocket” 세 가지를 비교함.

문서 수정·추가가 필요하면 SPEC.md 또는 이 문서에 “실시간 반영: SSE 채택, 폴링/WebSocket과의 비교는 REVIEW-REALTIME-UPDATE-SSE-WEBSOCKET-POLLING.md 참고”로 링크해 두면 됨.
