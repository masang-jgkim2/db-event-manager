# 이벤트 매니저 & DB 쿼리 매니저 - 개발 명세서

> 최종 업데이트: 2026-02-10
> 버전: v0.2.0

---

## 1. 프로젝트 개요

### 1.1 목적
게임 운영팀이 반복적으로 수행하는 이벤트 관련 DB 쿼리 작업을 웹 UI에서 자동화하는 내부 운영 도구.

### 1.2 대상 사용자
| 역할 | 코드 | 권한 |
|------|------|------|
| 관리자 | `admin` | 프로덕트/이벤트/사용자 관리 + 이벤트 생성 |
| GM | `gm` | 이벤트 생성 (쿼리 자동 생성) |
| 기획자 | `planner` | 이벤트 생성 (쿼리 자동 생성) |

### 1.3 핵심 프로세스
```
[관리자]
  1. 프로덕트 등록 (게임명, 약자, 서비스 범위)
  2. 이벤트 템플릿 등록 (쿼리 템플릿 + 종류/유형 + 입력 형식 + 기본값)
  3. 사용자 계정 생성 (GM, 기획자)

[사용자 (GM/기획자)]
  1. 프로덕트 선택 (예: 에이스온라인)
  2. 서비스 범위 선택 (예: AO/KR 국내) ← 1개뿐이면 자동 선택
  3. 이벤트 선택 (예: 이벤트 아이템 삭제)
  4. 이벤트 이름 자동 생성: [AO/KR] 2월 10일, 이벤트 아이템 삭제
  5. 기본 아이템값 자동 채움 (관리자가 설정한 예시값)
  6. 필요시 값 수정 후 쿼리 생성 → 클립보드 복사
```

### 1.4 데이터 흐름
```
[프론트엔드 (브라우저)]
  ↕ HTTP API (Axios + JWT)
[백엔드 서버 (Express, localhost:4000)]
  ↕ 서버 메모리 (배열) ← 추후 MySQL 전환 예정
[데이터]
  - 사용자: 서버 메모리
  - 프로덕트: 서버 메모리 (시드 7개 게임 포함)
  - 이벤트 템플릿: 서버 메모리
  - 이벤트 생성 이력: 브라우저 localStorage (개인별)
```

> **중요**: 현재 서버 메모리 저장이라 백엔드 재시작 시 관리자가 추가한 이벤트 템플릿은 초기화됨. 프로덕트 시드 데이터(7개 게임)는 서버 시작 시 자동 복원됨. MySQL 연동 후 영구 저장 전환 예정.

---

## 2. 기술 스택

### 2.1 Frontend
| 항목 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 프레임워크 | React | 19.x | UI 렌더링 |
| 언어 | TypeScript | 5.x | 타입 안정성 |
| 빌드 도구 | Vite | 7.x | 빠른 개발 서버/번들링 |
| UI 라이브러리 | Ant Design | 6.x | 어드민 UI 컴포넌트 |
| 상태 관리 | Zustand | 5.x | 경량 글로벌 상태 관리 |
| HTTP 클라이언트 | Axios | 1.x | API 통신 + 인터셉터 |
| 라우팅 | React Router DOM | 7.x | SPA 라우팅 |
| 날짜 처리 | dayjs | 1.x | 날짜 포맷팅 (antd 내장) |

### 2.2 Backend
| 항목 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 런타임 | Node.js | 22.x | 서버 실행 |
| 언어 | TypeScript | 5.x | 타입 안정성 |
| 프레임워크 | Express.js | 5.x | HTTP 서버 |
| 인증 | JWT (jsonwebtoken) | 9.x | 토큰 기반 인증 |
| 비밀번호 | bcryptjs | 3.x | 비밀번호 해싱 |
| 유효성 검증 | Zod | 4.x | 스키마 기반 검증 (예정) |
| 개발 도구 | tsx | 4.x | TS 직접 실행 + watch |

### 2.3 저장소 (현재 구현)
| 데이터 | 저장 위치 | 설명 |
|--------|----------|------|
| 사용자 | 서버 메모리 | 시드 2계정 (admin, gm01) + API로 CRUD |
| 프로덕트 | 서버 메모리 | 시드 7개 게임 + API로 CRUD |
| 이벤트 템플릿 | 서버 메모리 | API로 CRUD. 서버 재시작 시 초기화 |
| 이벤트 생성 이력 | 브라우저 localStorage | Zustand persist. 개인별 저장 |

### 2.4 저장소 (계획 - Phase 2)
| 항목 | 기술 |
|------|------|
| RDBMS | MySQL |
| ORM | Prisma |
| 컨테이너 | Docker + docker-compose |

---

## 3. 코딩 컨벤션

### 3.1 네이밍 (헝가리안 표기법)
| 접두사 | 타입 | 예시 |
|--------|------|------|
| `str` | 문자열 | `strUserId`, `strEventName` |
| `n` | 숫자 | `nId`, `nProductId` |
| `b` | 불리언 | `bIsAuthenticated`, `bModalOpen` |
| `arr` | 배열 | `arrProducts`, `arrEvents` |
| `obj` | 객체 | `objUser`, `objSelectedEvent` |
| `dt` | 날짜 | `dtCreatedAt` |
| `fn` | 함수 | `fnLogin`, `fnHandleSubmit` |

### 3.2 인터페이스/타입 접두사
| 접두사 | 용도 | 예시 |
|--------|------|------|
| `I` | 인터페이스 | `IUser`, `IProduct`, `IEventTemplate` |
| `T` | 타입 별칭 | `TEventCategory`, `TEventType` |
| `ARR_` | 상수 배열 | `ARR_EVENT_CATEGORIES`, `ARR_REGION_OPTIONS` |

### 3.3 파일/폴더 네이밍
| 종류 | 규칙 | 예시 |
|------|------|------|
| 페이지 | `PascalCase` + `Page` | `LoginPage.tsx`, `QueryPage.tsx` |
| 컴포넌트 | `PascalCase` | `MainLayout.tsx` |
| 스토어 | `use` + `PascalCase` + `Store` | `useAuthStore.ts` |
| API 모듈 | `camelCase` + `Api` | `authApi.ts`, `productApi.ts` |
| 컨트롤러 | `camelCase` + `Controller` | `authController.ts` |
| 라우트 | `camelCase` + `Routes` | `authRoutes.ts` |
| 데이터 | `camelCase` | `users.ts`, `products.ts` |
| 주석 | **한글** | `// 사용자 조회` |

---

## 4. 프로젝트 구조

```
db-event-manager/
├── front/                          # 프론트엔드 (React + Vite)
│   ├── src/
│   │   ├── api/                    # API 호출 모듈 (백엔드 통신)
│   │   │   ├── axiosInstance.ts    #   Axios 인스턴스 (베이스URL, 토큰 인터셉터, 401 처리)
│   │   │   ├── authApi.ts          #   인증 API (fnApiLogin, fnApiVerifyToken)
│   │   │   ├── userApi.ts          #   사용자 관리 API (CRUD + 비밀번호 초기화)
│   │   │   ├── productApi.ts       #   프로덕트 API (CRUD)
│   │   │   └── eventApi.ts         #   이벤트 템플릿 API (CRUD)
│   │   ├── components/             # 공통 컴포넌트
│   │   │   └── MainLayout.tsx      #   메인 레이아웃 (사이드바+헤더+콘텐츠, 역할별 메뉴 분기)
│   │   ├── pages/                  # 페이지 컴포넌트
│   │   │   ├── LoginPage.tsx       #   로그인 (보라색 그라디언트 카드 UI)
│   │   │   ├── DashboardPage.tsx   #   대시보드 - 통계 카드 + 프로덕트 현황 (관리자)
│   │   │   ├── ProductPage.tsx     #   프로덕트 관리 - CRUD + 서비스 범위 (관리자)
│   │   │   ├── EventPage.tsx       #   이벤트 템플릿 관리 - CRUD + 쿼리 템플릿 (관리자)
│   │   │   ├── UserPage.tsx        #   사용자 관리 - 계정 CRUD + 비밀번호 초기화 (관리자)
│   │   │   └── QueryPage.tsx       #   이벤트 생성 - 스텝 UI, 쿼리 자동 생성 (전체 역할)
│   │   ├── stores/                 # Zustand 상태 관리
│   │   │   ├── useAuthStore.ts     #   인증 (fnLogin/fnLogout/fnVerifyToken)
│   │   │   ├── useProductStore.ts  #   프로덕트 (서버 API 연동, fnFetchProducts)
│   │   │   ├── useEventStore.ts    #   이벤트 템플릿 (서버 API 연동, fnFetchEvents)
│   │   │   └── useQueryLogStore.ts #   이벤트 생성 이력 (localStorage persist)
│   │   ├── types/
│   │   │   └── index.ts            #   전체 타입/인터페이스/상수 정의
│   │   ├── App.tsx                 #   라우팅 + 인증가드 + 데이터 자동 로드
│   │   ├── main.tsx                #   엔트리포인트
│   │   └── index.css               #   글로벌 스타일
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                        # 백엔드 (Express)
│   ├── src/
│   │   ├── controllers/            # 비즈니스 로직
│   │   │   ├── authController.ts   #   로그인(fnLogin) / 토큰검증(fnVerifyToken)
│   │   │   ├── userController.ts   #   사용자 CRUD / 비밀번호 초기화
│   │   │   ├── productController.ts #  프로덕트 CRUD
│   │   │   └── eventController.ts  #   이벤트 템플릿 CRUD
│   │   ├── middleware/             # 미들웨어
│   │   │   ├── authMiddleware.ts   #   JWT 토큰 검증 → req.user 주입
│   │   │   └── roleMiddleware.ts   #   관리자 전용 (fnAdminOnly)
│   │   ├── routes/                 # 라우트 정의
│   │   │   ├── authRoutes.ts       #   /api/auth/* (공개/인증)
│   │   │   ├── userRoutes.ts       #   /api/users/* (관리자 전용)
│   │   │   ├── productRoutes.ts    #   /api/products/* (조회:인증, CUD:관리자)
│   │   │   └── eventRoutes.ts      #   /api/events/* (조회:인증, CUD:관리자)
│   │   ├── data/                   # 데이터 저장소 (서버 메모리, 추후 DB 교체)
│   │   │   ├── users.ts            #   사용자 배열 + 시드 (admin, gm01)
│   │   │   ├── products.ts         #   프로덕트 배열 + 시드 (7개 게임)
│   │   │   └── events.ts           #   이벤트 템플릿 배열 (빈 상태, 관리자가 추가)
│   │   ├── types/
│   │   │   └── index.ts            #   백엔드 타입 정의 (IUser, IJwtPayload 등)
│   │   └── index.ts                #   서버 엔트리 (Express 설정, 라우트 등록, 시작)
│   ├── .env.example                #   환경변수 템플릿
│   ├── package.json
│   └── tsconfig.json
│
├── db/                             # DB 스키마/마이그레이션 (Phase 2 예정)
├── design/                         # 디자인/와이어프레임 (예정)
├── docs/
│   └── SPEC.md                     #   이 문서
│
├── start.bat                       # 백엔드+프론트 동시 실행 + 브라우저 열기
├── stop.bat                        # 서버 전부 종료
├── update.bat                      # git pull + npm install (양쪽)
└── readme.md                       # 프로젝트 개요
```

---

## 5. API 명세

### 5.1 공통 규칙
- 베이스 URL: `http://localhost:4000/api`
- 인증 헤더: `Authorization: Bearer {JWT토큰}`
- 응답 형식: `{ bSuccess: boolean, strMessage?: string, ... }`
- 에러 코드: 400(입력 오류), 401(미인증), 403(권한 없음), 404(없음), 500(서버 오류)

### 5.2 인증 API

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `POST` | `/api/auth/login` | 공개 | 로그인 (JWT 발급) |
| `GET` | `/api/auth/verify` | 인증 | 토큰 검증 (자동 로그인) |

#### POST /api/auth/login
```json
// 요청
{ "strUserId": "admin", "strPassword": "admin123" }

// 성공 응답
{
  "bSuccess": true,
  "strToken": "eyJhbGciOi...",
  "user": { "nId": 1, "strUserId": "admin", "strDisplayName": "관리자", "strRole": "admin" }
}

// 실패 응답
{ "bSuccess": false, "strMessage": "아이디 또는 비밀번호가 올바르지 않습니다." }
```

#### GET /api/auth/verify
```json
// 성공 응답
{
  "bSuccess": true,
  "user": { "nId": 1, "strUserId": "admin", "strDisplayName": "관리자", "strRole": "admin" }
}
```

### 5.3 사용자 관리 API (관리자 전용)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/users` | 사용자 목록 조회 |
| `POST` | `/api/users` | 사용자 추가 |
| `DELETE` | `/api/users/:id` | 사용자 삭제 (본인 삭제 불가) |
| `PATCH` | `/api/users/:id/password` | 비밀번호 초기화 |

#### POST /api/users
```json
// 요청
{ "strUserId": "gm02", "strPassword": "gm123", "strDisplayName": "GM_김철수", "strRole": "gm" }

// 성공 응답
{ "bSuccess": true, "strMessage": "사용자가 생성되었습니다.", "user": { ... } }
```

### 5.4 프로덕트 API

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/products` | 인증 | 프로덕트 목록 조회 |
| `POST` | `/api/products` | 관리자 | 프로덕트 추가 |
| `PUT` | `/api/products/:id` | 관리자 | 프로덕트 수정 |
| `DELETE` | `/api/products/:id` | 관리자 | 프로덕트 삭제 |

#### GET /api/products
```json
// 응답
{
  "bSuccess": true,
  "arrProducts": [
    {
      "nId": 1,
      "strName": "출조낚시왕",
      "strDescription": "낚시 게임",
      "strDbType": "mysql",
      "arrServices": [{ "strAbbr": "FH", "strRegion": "국내" }],
      "dtCreatedAt": "2026-02-10T..."
    }
  ]
}
```

#### POST /api/products
```json
// 요청
{
  "strName": "신규게임",
  "strDescription": "설명",
  "strDbType": "mysql",
  "arrServices": [
    { "strAbbr": "NG/KR", "strRegion": "국내" },
    { "strAbbr": "NG/G", "strRegion": "글로벌" }
  ]
}
```

### 5.5 이벤트 템플릿 API

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/events` | 인증 | 이벤트 목록 조회 |
| `POST` | `/api/events` | 관리자 | 이벤트 추가 |
| `PUT` | `/api/events/:id` | 관리자 | 이벤트 수정 |
| `DELETE` | `/api/events/:id` | 관리자 | 이벤트 삭제 |

#### POST /api/events
```json
// 요청
{
  "nProductId": 5,
  "strEventLabel": "이벤트 아이템 삭제",
  "strDescription": "에이스온라인 이벤트 종료 후 아이템 일괄 삭제",
  "strCategory": "아이템",
  "strType": "삭제",
  "strInputFormat": "item_number",
  "strDefaultItems": "7518990, 7517750, 7517760",
  "strQueryTemplate": "DELETE FROM item_table WHERE item_id IN ({{items}});"
}
```

### 5.6 헬스 체크
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/health` | 서버 상태 확인 |

---

## 6. 데이터 모델

### 6.1 사용자 (IUser)
```typescript
interface IUser {
  nId: number;              // PK
  strUserId: string;        // 로그인 아이디 (unique)
  strPassword: string;      // bcrypt 해시
  strDisplayName: string;   // 표시 이름
  strRole: 'admin' | 'gm' | 'planner';
  dtCreatedAt: Date;
}
```

### 6.2 프로덕트 (IProduct)
```typescript
interface IProduct {
  nId: number;              // PK
  strName: string;          // 프로젝트명 (예: DK온라인)
  strDescription: string;   // 설명
  strDbType: 'mysql' | 'mssql' | 'postgresql';
  arrServices: IService[];  // 서비스 범위 목록 (1개 이상)
  dtCreatedAt: string;
}

interface IService {
  strAbbr: string;          // 약자 (예: DK/KR, AO/EU, FH)
  strRegion: string;        // 서비스 범위 (국내, 스팀, 글로벌, 유럽, 일본)
}
```

### 6.3 이벤트 템플릿 (IEventTemplate)
```typescript
// 이벤트 종류
type TEventCategory = '아이템' | '퀘스트';

// 이벤트 유형
type TEventType = '삭제' | '지급' | '초기화';

// 입력 형식
type TInputFormat = 'item_number' | 'item_string' | 'date' | 'none';
// item_number: 숫자 쉼표 구분 (예: 7902, 9471, 9138)
// item_string: 문자열 줄바꿈 구분 (예: 2012_yuki_giftbox\n2012_yuki_ticket)
// date: 날짜 문자열 (예: 20251125)
// none: 입력 없음

interface IEventTemplate {
  nId: number;              // PK
  nProductId: number;       // FK → IProduct.nId
  strProductName: string;   // 프로덕트명 (서버에서 자동 매핑)
  strEventLabel: string;    // 이벤트명 (예: 어워드 이벤트 종료(아이템))
  strDescription: string;   // 설명 (사용자에게 표시)
  strCategory: TEventCategory;    // 이벤트 종류
  strType: TEventType;            // 이벤트 유형
  strInputFormat: TInputFormat;   // 입력 형식
  strDefaultItems: string;  // 기본 아이템값 (사용자에게 자동 채워짐, 비워둘 수 있음)
  strQueryTemplate: string; // SQL 쿼리 템플릿 (치환 변수 포함)
  dtCreatedAt: string;
}
```

**쿼리 템플릿 치환 변수:**
| 변수 | 설명 | 치환 예시 |
|------|------|----------|
| `{{items}}` | 사용자가 입력한 아이템값 | `7902, 9471, 9138` |
| `{{date}}` | 실행 날짜 (YYYY-MM-DD) | `2026-02-10` |
| `{{event_name}}` | 자동 생성된 이벤트 이름 | `[AO/KR] 2월 10일, 아이템 삭제` |
| `{{abbr}}` | 선택된 서비스 약자 | `AO/KR` |
| `{{product}}` | 프로덕트명 | `에이스온라인` |
| `{{region}}` | 서비스 범위 | `국내` |

### 6.4 이벤트 생성 이력 (IQueryLog) - 브라우저 localStorage
```typescript
interface IQueryLog {
  nId: number;
  strEventName: string;       // 자동 생성된 이벤트 이름
  strProductName: string;
  strServiceAbbr: string;     // 선택된 서비스 약자
  strServiceRegion: string;   // 선택된 서비스 범위
  strCategory: string;        // 이벤트 종류
  strType: string;            // 이벤트 유형
  strInputValues: string;     // 입력된 값
  strGeneratedQuery: string;  // 생성된 쿼리
  strCreatedBy: string;       // 생성자
  dtCreatedAt: string;
}
```

---

## 7. 화면 명세

### 7.1 로그인 페이지 (`/login`)
- 보라색 그라디언트 배경 (`#667eea → #764ba2`) + 흰색 카드형 폼
- 아이디/비밀번호 입력 → `POST /api/auth/login` → JWT 발급 → `localStorage.strToken` 저장
- 인증 완료 시 역할별 자동 리다이렉트:
  - admin → `/` (대시보드)
  - gm, planner → `/query` (이벤트 생성)

### 7.2 관리자 전용 화면

#### 대시보드 (`/`)
- 통계 카드 4개: 프로덕트 수, 이벤트 템플릿 수, 생성된 이벤트 수, 서비스 총 수
- 프로덕트 현황 테이블 (프로젝트명, 서비스 태그, 이벤트 수)

#### 프로덕트 관리 (`/products`)
- 프로덕트 목록 테이블 (이름, 서비스 범위 태그, DB 타입 태그)
- 추가/수정 모달:
  - 프로젝트명 (필수)
  - DB 타입 선택: MySQL / MSSQL / PostgreSQL (필수)
  - 설명 (선택)
  - 서비스 범위 (동적 추가/삭제, 최소 1개):
    - 약자 입력 (예: `DK/KR`)
    - 서비스 범위 선택 (국내 / 스팀 / 글로벌 / 유럽 / 일본)
- 삭제: Popconfirm 확인 후 삭제

#### 이벤트 템플릿 (`/events`)
- 이벤트 목록 테이블 (프로덕트, 이벤트명, 종류 태그, 유형 태그, 입력 형식, 기본값)
- 추가/수정 모달:
  - 프로덕트 선택 (드롭다운, 필수)
  - 이벤트명 (필수, 예: `어워드 이벤트 종료(아이템)`)
  - 이벤트 종류 (아이템 / 퀘스트, 필수)
  - 이벤트 유형 (삭제 / 지급 / 초기화, 필수)
  - 입력 형식 (아이템 번호 / 아이템 문자열 / 날짜 / 입력 없음, 필수)
  - 설명 (선택, 사용자에게 표시)
  - 기본 아이템값 (선택, 사용자에게 자동 채워짐)
  - 쿼리 템플릿 (선택, `{{items}}` `{{date}}` 등 치환 변수 사용)

#### 사용자 관리 (`/users`)
- 사용자 목록 테이블 (아이디, 이름, 역할 태그, 생성일)
- 추가 모달: 아이디, 비밀번호, 이름, 역할 (gm / planner / admin)
- 비밀번호 초기화 모달: 새 비밀번호 입력
- 삭제: Popconfirm 확인 (본인 삭제 불가)

### 7.3 공통 화면 (전체 역할)

#### 이벤트 생성 (`/query`)
상단에 Steps 컴포넌트로 진행 단계 표시 (프로덕트 → 서비스 → 이벤트 → 값 입력 → 완료)

**좌측 패널 (입력):**
- **Step 1**: 프로덕트 선택 (드롭다운, 약자 표시)
- **Step 2**: 서비스 범위 선택 (서비스가 1개뿐이면 자동 선택, 2개 이상이면 드롭다운)
- **Step 3**: 이벤트 선택 (드롭다운, 종류/유형 태그 표시 + 설명 Alert)
- **Step 4**: 이벤트 정보 입력
  - 이벤트 이름: `[약자] M월 D일, 이벤트설명` 패턴 자동 생성 (수정 가능)
  - 실행 날짜: DatePicker (미입력 시 오늘 날짜)
  - 입력값 (형식에 따라):
    - `item_number`: 숫자 쉼표 구분 입력 (TextArea 4행)
    - `item_string`: 문자열 줄바꿈 구분 입력 (TextArea 8행)
    - `date`: 날짜 문자열 입력
    - `none`: 입력 UI 없음
  - 기본 아이템값: 관리자가 설정한 값이 자동 채워짐
- 쿼리 생성 버튼 (보라색 그라디언트)

**우측 패널 (결과):**
- 생성된 쿼리: 다크 테마 TextArea (Consolas 폰트, `#1e1e1e` 배경)
- 이벤트 이름 Alert (성공 표시)
- 복사 버튼 (클립보드)
- 초기화 버튼

**하단:** 이벤트 생성 이력 테이블 (시간, 이벤트 이름, 종류, 유형, 생성자, 쿼리)

### 7.4 공통 레이아웃 (MainLayout)
- **사이드바** (왼쪽 고정, 접기/펼치기 가능):
  - 로고 + 타이틀 "이벤트 매니저"
  - 관리자: 대시보드, 프로덕트 관리, 이벤트 템플릿, 사용자 관리, 이벤트 생성
  - GM/기획자: 이벤트 생성만
- **헤더** (상단 고정):
  - 사이드바 토글 버튼
  - 사용자 이름 + 역할 태그 + 로그아웃 드롭다운
  - 관리자: 빨간 아바타, GM: 파란 아바타
- **콘텐츠**: 중앙 영역, 좌측 margin 200px (접힌 경우 80px)

---

## 8. 인증 & 권한

### 8.1 인증 흐름
```
1. 로그인 → POST /api/auth/login → JWT 토큰 발급 (24h 만료)
2. 토큰을 localStorage에 저장 (key: strToken)
3. 이후 모든 API 요청 → Axios 인터셉터가 Authorization: Bearer {token} 자동 삽입
4. 서버: authMiddleware에서 JWT 검증 → req.user에 { nId, strUserId, strRole } 주입
5. 401 응답 시 → Axios 인터셉터가 토큰 삭제, 로그인 페이지로
```

### 8.2 권한 매트릭스
| 기능 | API 경로 | admin | gm | planner |
|------|----------|-------|----|---------|
| 대시보드 | (프론트 전용) | O | X | X |
| 프로덕트 목록 | `GET /api/products` | O | O | O |
| 프로덕트 CUD | `POST/PUT/DELETE /api/products` | O | X | X |
| 이벤트 목록 | `GET /api/events` | O | O | O |
| 이벤트 CUD | `POST/PUT/DELETE /api/events` | O | X | X |
| 사용자 관리 | `/api/users/*` | O | X | X |
| 이벤트 생성 | (프론트 전용) | O | O | O |

### 8.3 프론트엔드 라우트 가드
| 가드 | 동작 |
|------|------|
| `ProtectedRoute` | 미인증 → `/login` 리다이렉트 |
| `AdminRoute` | admin 외 → 403 결과 화면 표시 |
| `PublicRoute` | 인증 완료 → 역할별 메인 페이지 리다이렉트 |
| `DefaultRedirect` | 미매칭 경로 → 역할별 메인 페이지 |

---

## 9. 등록된 프로덕트 (시드 데이터, 서버 내장)

| nId | 프로젝트명 | 약자 | 서비스 범위 | DB 타입 |
|-----|-----------|------|------------|---------|
| 1 | 출조낚시왕 | FH | 국내 | MySQL |
| 2 | DK온라인 | DK/KR, DK/G | 국내, 스팀 | MySQL |
| 3 | 콜오브카오스 | CC | 국내 | MySQL |
| 4 | 아스다스토리 | AD/G | 글로벌 | MySQL |
| 5 | 에이스온라인 | AO/KR, AO/EU, AO/JP | 국내, 유럽, 일본 | MySQL |
| 6 | 라그하임 | LH | 국내 | MySQL |
| 7 | 스키드러시 | SR | 국내 | MySQL |

> 위 데이터는 `backend/src/data/products.ts`에 하드코딩되어 서버 시작 시 자동 로드됨.

---

## 10. 기본 계정 (서버 내장)

| 아이디 | 비밀번호 | 역할 | 설명 |
|--------|----------|------|------|
| `admin` | `admin123` | 관리자 | 전체 관리 + 이벤트 생성 |
| `gm01` | `gm123` | GM | 이벤트 생성만 가능 |

> `backend/src/data/users.ts`에 정의. 서버 시작 시 bcrypt 해싱.

---

## 11. 실행 방법

### 11.1 사전 조건
- Node.js 20+ (https://nodejs.org LTS 버전)
- Git

### 11.2 최초 설치
```bash
git clone https://github.com/masang-jgkim2/db-event-manager.git
cd db-event-manager
git checkout cursor/readme-342b

# 백엔드
cd backend
npm install
copy .env.example .env    # Windows
# cp .env.example .env    # Mac/Linux

# 프론트엔드
cd ../front
npm install
```

### 11.3 실행 (Windows 배치파일)
| 파일 | 기능 |
|------|------|
| `update.bat` | 최신 소스 pull + 양쪽 npm install + 루트 복귀 |
| `start.bat` | 백엔드(4000) + 프론트(5173) 동시 실행 + 브라우저 자동 열기 |
| `stop.bat` | 서버 전부 종료 |

순서: `update.bat` → `start.bat`

### 11.4 수동 실행
```bash
# 터미널 1 - 백엔드 (http://localhost:4000)
cd backend && npm run dev

# 터미널 2 - 프론트엔드 (http://localhost:5173)
cd front && npm run dev
```

### 11.5 환경변수 (`backend/.env`)
```
PORT=4000
JWT_SECRET=event-manager-secret-key-change-in-production
JWT_EXPIRES_IN=24h
```

### 11.6 npm scripts
| 위치 | 명령어 | 설명 |
|------|--------|------|
| backend | `npm run dev` | tsx watch 개발 서버 (핫 리로드) |
| backend | `npm run build` | TypeScript 컴파일 (dist/) |
| backend | `npm start` | 프로덕션 실행 (dist/index.js) |
| front | `npm run dev` | Vite 개발 서버 (핫 리로드) |
| front | `npm run build` | 프로덕션 빌드 (dist/) |

---

## 12. 상태 관리 (Zustand)

| 스토어 | 데이터 소스 | 용도 |
|--------|-----------|------|
| `useAuthStore` | localStorage (`strToken`) + API | 로그인/로그아웃/토큰 검증 |
| `useProductStore` | 서버 API (`/api/products`) | 프로덕트 목록 + CRUD |
| `useEventStore` | 서버 API (`/api/events`) | 이벤트 템플릿 목록 + CRUD |
| `useQueryLogStore` | localStorage (`em-query-logs`) | 이벤트 생성 이력 (개인별) |

**데이터 로드 시점:**
- `App.tsx`에서 `bIsAuthenticated`가 `true`로 변경될 때 `fnFetchProducts()` + `fnFetchEvents()` 자동 호출
- 모든 브라우저에서 같은 서버 데이터를 조회하므로 데이터 동기화 문제 없음

---

## 13. 향후 계획 (TODO)

### Phase 2 - DB 연동 (영구 저장)
- [ ] MySQL 서버 구축 (Docker)
- [ ] Prisma 스키마 정의: users, products, services, event_templates, query_logs
- [ ] backend/src/data/* → Prisma Client 호출로 교체
- [ ] 이벤트 생성 이력도 서버 DB로 이전

### Phase 3 - 기능 고도화
- [ ] 실제 쿼리 템플릿 등록 (게임별 운영 쿼리)
- [ ] 쿼리 실행 전 미리보기/검증
- [ ] 이벤트 생성 이력 검색/필터/내보내기
- [ ] 이벤트 승인 워크플로 (생성 → 검토 → 실행)
- [ ] 쿼리 직접 실행 기능 (게임 DB 연결)
- [ ] 다중 아이템 입력 UI 개선 (태그 입력 등)

### Phase 4 - 운영 안정화
- [ ] Docker compose 배포 환경
- [ ] Swagger API 문서 자동화
- [ ] ESLint + Prettier 적용
- [ ] 접속 로그 / 감사 로그
- [ ] 비밀번호 변경 (본인)
- [ ] HTTPS 적용

---

## 14. 이 문서 활용법

### AI 에이전트에게 전달할 때
```
docs/SPEC.md 를 읽고 프로젝트 구조를 파악한 후 작업을 진행해주세요.
```
이 한 줄로 프로젝트 전체 컨텍스트(기술 스택, 구조, API, 데이터 모델, 화면 명세, 컨벤션)를 전달할 수 있습니다.

### 다른 프로젝트에 템플릿으로 활용할 때
이 문서의 섹션 구조를 복사하여 내용만 교체:
1. 프로젝트 개요 → 목적, 대상, 프로세스
2. 기술 스택 → 사용 기술 목록
3. 코딩 컨벤션 → 네이밍, 파일 구조 규칙
4. 프로젝트 구조 → 폴더/파일 트리 + 설명
5. API 명세 → 엔드포인트, 요청/응답 예시
6. 데이터 모델 → TypeScript 인터페이스
7. 화면 명세 → 페이지별 기능 상세
8. 인증 & 권한 → 흐름, 권한 매트릭스
9. 시드 데이터 → 초기 데이터
10. 기본 계정 → 테스트용 계정
11. 실행 방법 → 설치, 실행 명령어
12. 상태 관리 → 프론트 스토어 구조
13. 향후 계획 → 로드맵
14. 활용법 → 이 섹션
