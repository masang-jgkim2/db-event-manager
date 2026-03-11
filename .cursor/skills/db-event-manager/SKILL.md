---
name: db-event-manager
description: DB Event Manager 프로젝트 전체 컨텍스트. 이 프로젝트에서 신규 기능 구현, 버그 수정, 코드 리뷰 요청 시 사용. 백엔드(Node/Express/TS), 프론트(React/Vite/TS/AntD), 인메모리 DB, MSSQL/MySQL 쿼리 실행, RBAC, SSE 실시간 업데이트를 다룬다.
---

# DB Event Manager — 프로젝트 컨텍스트

## 기술 스택

| 영역 | 스택 |
|------|------|
| 백엔드 | Node.js, Express, TypeScript, JWT, bcryptjs, Zod |
| 프론트엔드 | React, Vite, TypeScript, Ant Design, Zustand, Axios, React Router DOM |
| DB 드라이버 | mssql (주), mysql2/promise |
| 실시간 | Server-Sent Events (SSE) |
| 데이터 | 인메모리 (→ 추후 DB 마이그레이션, Repository 패턴 적용됨) |

## 핵심 도메인

- **이벤트 인스턴스**: 게임 이벤트 배포 워크플로 (draft → qa_deployed → live_deployed 등)
- **쿼리 실행**: 이벤트 아이템/퀘스트 데이터를 DEV/QA/LIVE DB에 반영
- **RBAC**: 동적 역할/권한 (admin, dba, game_manager, game_designer + 커스텀)
- **실시간 업데이트**: SSE로 인스턴스 상태 변경을 즉시 반영

## 주요 파일 위치

```
backend/src/
  controllers/eventInstanceController.ts  # 워크플로 + 실행 로직
  services/queryExecutor.ts               # SQL 파싱 + 트랜잭션 실행
  services/sseBroadcaster.ts              # SSE 클라이언트 관리
  db/dbManager.ts                         # 커넥션 풀
  data/roles.ts                           # 인메모리 역할/권한
  middleware/permissionMiddleware.ts       # 권한 검사

front/src/
  pages/MyDashboardPage.tsx               # 이벤트 인스턴스 관리 메인
  pages/QueryPage.tsx                     # 이벤트 생성
  stores/useEventInstanceStore.ts         # 인스턴스 상태 관리
  hooks/useEventStream.ts                 # SSE 연결 훅
  components/MainLayout.tsx               # 사이드바 + 메뉴 권한 처리
```

## 권한 종류

```
product.view / product.manage
event_template.view / event_template.manage
user.manage / db.manage
instance.create
instance.approve_qa / instance.execute_qa / instance.verify_qa
instance.approve_live / instance.execute_live / instance.verify_live
```

## 반영 날짜 검증 규칙

- DEV/QA: `현재시간 < dtDeployDate` 이어야 실행 허용
- LIVE: `현재시간 >= dtDeployDate` 이어야 실행 허용

## 인메모리 데이터 위치

`backend/src/data/` — 추후 `backend/src/repositories/` 패턴으로 DB 교체 예정.
스키마는 `docs/schema.sql` 참조.
