# Database Query Process Manager (DQPM)

## 개요

반복적인 이벤트·쿼리 프로세스를 **DEV → QA → LIVE** 단계로 관리하는 웹 애플리케이션입니다.  
쿼리 템플릿 기반 이벤트·쿼리 생성, 반영 범위(QA/LIVE) 설정, 권한별 워크플로(컨펌·실행·확인)와 실시간 상태 반영을 지원합니다.

## 대상 사용자

- **GM(게임 마스터) / 기획자**: 이벤트 생성, 반영 요청, QA/LIVE 확인
- **DBA**: 컨펌, QA/LIVE DB 쿼리 실행, 쿼리 직접 수정
- **관리자**: 프로덕트·쿼리 템플릿·DB 접속·사용자·역할 권한 관리

## 핵심 기능

1. **프로덕트·쿼리 템플릿**
   - 프로덕트(게임/서비스)별 쿼리 템플릿 관리
   - 단일/다중 쿼리 세트 지원(세트별 DB 연결·쿼리 템플릿·기본 입력값)
   - 치환자(`{{items}}`, `{{date}}`, `{{event_name}}` 등) 기반 쿼리 자동 생성

2. **이벤트 생성**
   - 프로덕트·국내/해외·이벤트 선택 후 입력값 입력
   - **반영 범위** 선택(QA/LIVE, 단일 또는 다중)
   - 다중 세트 시 세트별 입력·생성 쿼리 탭 표시

3. **나의 대시보드**
   - 이벤트 인스턴스 목록(진행 중/완료/숨김 탭, 테이블·카드 보기)
   - **반영** 컬럼: DEV / QA / LIVE 단계 표시
   - 상세·수정(컨펌 요청 전)·쿼리 수정(DBA)·컨펌·QA/LIVE 실행·확인·재요청 등 권한별 액션
   - 상세/수정/쿼리 수정 시 다중 쿼리 세트 탭 표시, 반영 범위(QA/LIVE) 표시

4. **쿼리 실행**
   - 단일·다중 쿼리 세트 모두 지원(요청 env에 맞는 DB 접속으로 실행)
   - 반영 날짜 검증(DEV/QA: 반영일 이전, LIVE: 반영일 이후만 실행)
   - MSSQL/MySQL 트랜잭션 실행 및 결과 모달

5. **권한·실시간**
   - 메뉴/버튼은 **보기·상세·수정·실행** 등 세분화된 권한으로 제어
   - Server-Sent Events(SSE)로 인스턴스 상태 변경 실시간 반영

## 기술 스택

| 영역 | 스택 |
|------|------|
| **프론트엔드** | React, Vite, TypeScript, Ant Design, Zustand, Axios, React Router DOM |
| **백엔드** | Node.js, Express, TypeScript, JWT, bcryptjs, Zod |
| **DB 실행** | mssql, mysql2/promise (프로덕트·환경별 접속) |
| **데이터** | `STORE_BACKEND=json`→`data/` JSON; `rdb`→시스템 MSSQL(`DB_SYSTEM_*`). RDB→JSON 파일 동기 불필요. |
| **실시간** | Server-Sent Events (SSE) |

## 폴더 구조

```
/
├── front/          # React + Vite + Ant Design
├── backend/        # Express + TypeScript, persistence/ 영속 스위치
├── docs/           # 스펙, 권한, 스키마 검토 등
└── readme.md
```

## 백엔드 환경 변수 (요약)

| 변수 | 설명 |
|------|------|
| `DATA_DIR` | JSON 데이터 폴더 (미설정 시 `backend` 기준 `data/`) |
| `STORE_BACKEND` | `json`(기본) — 파일·인메모리. `rdb` — 시스템 MSSQL(`DB_SYSTEM_*`) 사용, **접속·RBAC·프로덕트·쿼리템플릿·이벤트 인스턴스** 등 테이블 동기화(하이드레이트 조건은 코드 참고) |
| `SEED_TEST_WITH_RDB` | `1` 또는 `true`일 때만 `STORE_BACKEND=rdb`에서 `seed_test.json`을 메모리에 적용한 뒤 접속·카탈로그·auth를 RDB에 플러시. 기본은 시드 무시 |
| `DB_SYSTEM_HOST` 등 | `STORE_BACKEND=rdb` 시 필수. `backend/.env.example` 참고 |

**롤백**: `STORE_BACKEND=json`으로 되돌리고, 전환 전 `npm run backup:data`(backend 디렉터리)로 복사해 둔 `data` 폴더를 복원한다.

**RDB 데이터만 비우기**(스키마·`_migrations` 유지): `backend`에서 `npm run rdb:reset` — 시스템 테이블 행 전부 삭제 후 다음 기동 시 비어 있으면 JSON 기준으로 동작.

## 영속 레이어

- **목표**: `STORE_BACKEND` 한 스위치로 원천 전환 — `json`은 `data/`, `rdb`는 시스템 DB. **JSON→RDB 이관은 저장(플러시)으로 달성; RDB 내용을 JSON에 맞출 필요 없음.**
- **구현 위치**: `backend/src/persistence/` (`storeBackend.ts`, `bootstrap.ts`, `rdb/*Persistence.ts`, `rdb/*PersistHelper.ts`).
- **부팅 순서**: `index.ts` → `fnBootstrapPersistence()`(마이그레이션 + 조건부 RDB→메모리) → `seed_test.json`은 `STORE_BACKEND=rdb`에서 기본 무시(`SEED_TEST_WITH_RDB=1`이면 시드 후 접속·카탈로그·auth RDB 플러시) → `app` 동적 import. 카탈로그 하이드레이트는 `products`·`event_templates` 동시 존재 시만 적용(부분 RDB 행은 생략·JSON 유지).
- **마이그레이션**: `STORE_BACKEND=rdb`일 때만 `backend/src/db/migrationRunner.ts`가 `migrations/` 적용(`V002`~`V003` 등).
