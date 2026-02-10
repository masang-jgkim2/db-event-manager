# 이벤트 매니저 & DB 쿼리 매니저 - 개발 명세서

> 최종 업데이트: 2026-02-10
> 버전: v0.1.0 (MVP)

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
  프로덕트 등록 → 이벤트 템플릿 등록 (쿼리 템플릿 + 파라미터 정의 + 기본값)

[사용자 (GM/기획자)]
  프로덕트 선택 → 서비스 범위 선택 → 이벤트 선택
  → 이벤트 이름 자동 생성 → 값 입력 → 쿼리 자동 생성 → 복사
```

---

## 2. 기술 스택

### 2.1 Frontend
| 항목 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 프레임워크 | React | 19.x | UI 렌더링 |
| 언어 | TypeScript | 5.x | 타입 안정성 |
| 빌드 도구 | Vite | 7.x | 빠른 개발 서버/번들링 |
| UI 라이브러리 | Ant Design | 6.x | 어드민 UI 컴포넌트 |
| 상태 관리 | Zustand | 5.x | 경량 글로벌 상태 관리 (persist 지원) |
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

### 2.3 저장소 (현재)
| 항목 | 기술 | 비고 |
|------|------|------|
| 사용자 데이터 | 서버 메모리 (배열) | 추후 MySQL 전환 예정 |
| 프로덕트/이벤트/로그 | 브라우저 localStorage | Zustand persist 미들웨어 |

### 2.4 저장소 (계획)
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

### 3.2 인터페이스 접두사
| 접두사 | 용도 | 예시 |
|--------|------|------|
| `I` | 인터페이스 | `IUser`, `IProduct`, `IEventTemplate` |
| `T` | 타입 별칭 | `TEventCategory`, `TEventType` |
| `ARR_` | 상수 배열 | `ARR_EVENT_CATEGORIES`, `ARR_REGION_OPTIONS` |

### 3.3 파일/폴더 구조
- 페이지: `PascalCase` + `Page` 접미사 (예: `LoginPage.tsx`)
- 컴포넌트: `PascalCase` (예: `MainLayout.tsx`)
- 스토어: `use` + `PascalCase` + `Store` (예: `useAuthStore.ts`)
- API: `camelCase` + `Api` 접미사 (예: `authApi.ts`)
- 주석: **한글**

---

## 4. 프로젝트 구조

```
db-event-manager/
├── front/                          # 프론트엔드 (React + Vite)
│   ├── src/
│   │   ├── api/                    # API 호출 모듈
│   │   │   ├── axiosInstance.ts    #   Axios 인스턴스 (토큰 인터셉터)
│   │   │   ├── authApi.ts          #   인증 API (로그인, 토큰검증)
│   │   │   └── userApi.ts          #   사용자 관리 API
│   │   ├── components/             # 공통 컴포넌트
│   │   │   └── MainLayout.tsx      #   메인 레이아웃 (사이드바+헤더+콘텐츠)
│   │   ├── pages/                  # 페이지 컴포넌트
│   │   │   ├── LoginPage.tsx       #   로그인 페이지
│   │   │   ├── DashboardPage.tsx   #   대시보드 (관리자)
│   │   │   ├── ProductPage.tsx     #   프로덕트 관리 (관리자)
│   │   │   ├── EventPage.tsx       #   이벤트 템플릿 관리 (관리자)
│   │   │   ├── UserPage.tsx        #   사용자 관리 (관리자)
│   │   │   └── QueryPage.tsx       #   이벤트 생성 (전체)
│   │   ├── stores/                 # Zustand 상태 관리
│   │   │   ├── useAuthStore.ts     #   인증 상태 (로그인/로그아웃/토큰)
│   │   │   ├── useProductStore.ts  #   프로덕트 CRUD + 시드 데이터
│   │   │   ├── useEventStore.ts    #   이벤트 템플릿 CRUD
│   │   │   └── useQueryLogStore.ts #   이벤트 생성 이력
│   │   ├── types/
│   │   │   └── index.ts            #   전체 타입 정의
│   │   ├── App.tsx                 #   라우팅 + 인증 가드
│   │   ├── main.tsx                #   엔트리포인트
│   │   └── index.css               #   글로벌 스타일
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                        # 백엔드 (Express)
│   ├── src/
│   │   ├── controllers/            # 비즈니스 로직
│   │   │   ├── authController.ts   #   로그인/토큰검증
│   │   │   └── userController.ts   #   사용자 CRUD/비밀번호 초기화
│   │   ├── middleware/             # 미들웨어
│   │   │   ├── authMiddleware.ts   #   JWT 토큰 검증
│   │   │   └── roleMiddleware.ts   #   관리자 권한 체크
│   │   ├── routes/                 # 라우트 정의
│   │   │   ├── authRoutes.ts       #   /api/auth/*
│   │   │   └── userRoutes.ts       #   /api/users/*
│   │   ├── data/
│   │   │   └── users.ts            #   사용자 데이터 저장소 (임시)
│   │   ├── types/
│   │   │   └── index.ts            #   백엔드 타입 정의
│   │   └── index.ts                #   서버 엔트리포인트
│   ├── .env.example                #   환경변수 템플릿
│   ├── package.json
│   └── tsconfig.json
│
├── db/                             # DB 스키마/마이그레이션 (예정)
├── design/                         # 디자인/와이어프레임 (예정)
├── docs/
│   └── SPEC.md                     #   이 문서
│
├── start.bat                       # 서버 시작 (Windows)
├── stop.bat                        # 서버 종료 (Windows)
├── update.bat                      # git pull + npm install
└── readme.md                       # 프로젝트 개요
```

---

## 5. API 명세

### 5.1 인증 API

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
  "user": {
    "nId": 1,
    "strUserId": "admin",
    "strDisplayName": "관리자",
    "strRole": "admin"
  }
}

// 실패 응답
{ "bSuccess": false, "strMessage": "아이디 또는 비밀번호가 올바르지 않습니다." }
```

#### GET /api/auth/verify
```
Headers: Authorization: Bearer {token}
```
```json
// 성공 응답
{
  "bSuccess": true,
  "user": { "nId": 1, "strUserId": "admin", "strDisplayName": "관리자", "strRole": "admin" }
}
```

### 5.2 사용자 관리 API (관리자 전용)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/users` | 사용자 목록 조회 |
| `POST` | `/api/users` | 사용자 추가 |
| `DELETE` | `/api/users/:id` | 사용자 삭제 |
| `PATCH` | `/api/users/:id/password` | 비밀번호 초기화 |

#### POST /api/users
```json
// 요청
{
  "strUserId": "gm02",
  "strPassword": "gm123",
  "strDisplayName": "GM_김철수",
  "strRole": "gm"
}
```

### 5.3 헬스 체크
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
  arrServices: IService[];  // 서비스 범위 목록
  dtCreatedAt: string;
}

interface IService {
  strAbbr: string;          // 약자 (예: DK/KR, AO/EU)
  strRegion: string;        // 서비스 범위 (국내, 스팀, 글로벌, 유럽, 일본)
}
```

### 6.3 이벤트 템플릿 (IEventTemplate)
```typescript
interface IEventTemplate {
  nId: number;              // PK
  nProductId: number;       // FK → IProduct.nId
  strProductName?: string;  // 프로덕트명 (조인용)
  strEventLabel: string;    // 이벤트명 (예: 어워드 이벤트 종료(아이템))
  strDescription: string;   // 설명
  strCategory: '아이템' | '퀘스트';           // 이벤트 종류
  strType: '삭제' | '지급' | '초기화';        // 이벤트 유형
  strInputFormat: 'item_number' | 'item_string' | 'date' | 'none';  // 입력 형식
  strDefaultItems: string;  // 기본 아이템값 (사용자에게 자동 채워짐)
  strQueryTemplate: string; // SQL 쿼리 템플릿
  dtCreatedAt: string;
}
```

**쿼리 템플릿 치환 변수:**
| 변수 | 설명 | 예시 |
|------|------|------|
| `{{items}}` | 사용자가 입력한 아이템값 | `7902, 9471, 9138` |
| `{{date}}` | 실행 날짜 | `2026-02-10` |
| `{{event_name}}` | 자동 생성된 이벤트 이름 | `[AO/KR] 2월 10일, 아이템 삭제` |
| `{{abbr}}` | 서비스 약자 | `AO/KR` |
| `{{product}}` | 프로덕트명 | `에이스온라인` |
| `{{region}}` | 서비스 범위 | `국내` |

### 6.4 이벤트 생성 로그 (IQueryLog)
```typescript
interface IQueryLog {
  nId: number;
  strEventName: string;       // 자동 생성된 이벤트 이름
  strProductName: string;     // 프로덕트명
  strServiceAbbr: string;     // 서비스 약자
  strServiceRegion: string;   // 서비스 범위
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
- 보라색 그라디언트 배경 + 카드형 로그인 폼
- 아이디/비밀번호 입력 → JWT 발급 → localStorage 저장
- 인증 완료 시 역할별 리다이렉트 (admin→대시보드, gm→이벤트 생성)

### 7.2 관리자 전용 화면

#### 대시보드 (`/`)
- 통계 카드: 프로덕트 수, 이벤트 수, 생성된 이벤트 수, 서비스 수
- 프로덕트 현황 테이블 (프로덕트별 이벤트 수 포함)

#### 프로덕트 관리 (`/products`)
- 프로덕트 목록 테이블 (이름, 서비스 범위, DB 타입)
- 추가/수정 모달: 프로젝트명, DB 타입, 서비스 범위 (동적 추가/삭제)
- 서비스 범위: 약자 + 리전 (예: `DK/KR` + `국내`)

#### 이벤트 템플릿 (`/events`)
- 이벤트 목록 테이블 (프로덕트, 이벤트명, 종류, 유형, 입력 형식)
- 추가/수정 모달:
  - 프로덕트 선택
  - 이벤트명, 종류(아이템/퀘스트), 유형(삭제/지급/초기화)
  - 입력 형식 (아이템번호/아이템문자열/날짜/없음)
  - 기본 아이템값 (사용자에게 자동 채워지는 예시값)
  - 쿼리 템플릿 (`{{items}}`, `{{date}}` 등 치환 변수)

#### 사용자 관리 (`/users`)
- 사용자 목록 테이블 (아이디, 이름, 역할, 생성일)
- 추가 모달: 아이디, 비밀번호, 이름, 역할 선택
- 비밀번호 초기화 / 삭제

### 7.3 공통 화면

#### 이벤트 생성 (`/query`)
- **Step 1**: 프로덕트 선택 (드롭다운)
- **Step 2**: 서비스 범위 선택 (서비스가 1개뿐이면 자동 선택)
- **Step 3**: 이벤트 선택 (종류/유형 태그 표시)
- **Step 4**: 이벤트 정보 입력
  - 이벤트 이름: `[약자] M월 D일, 이벤트설명` 패턴 자동 생성 (수정 가능)
  - 실행 날짜: DatePicker (미입력 시 오늘)
  - 입력값: 형식에 맞는 입력 UI (숫자 목록 / 문자열 목록 / 날짜)
  - 기본 아이템값 자동 채움
- **결과**: 생성된 쿼리를 다크 테마 에디터에 표시 + 클립보드 복사
- **하단**: 이벤트 생성 이력 테이블

---

## 8. 인증 & 권한

### 8.1 인증 흐름
```
로그인 → JWT 토큰 발급 (24h) → localStorage 저장
         ↓
매 API 요청 → Authorization: Bearer {token} 헤더 자동 삽입 (Axios 인터셉터)
         ↓
서버에서 JWT 검증 → req.user에 페이로드 주입
```

### 8.2 권한 체계
| 기능 | admin | gm | planner |
|------|-------|----|---------|
| 대시보드 | O | X | X |
| 프로덕트 관리 | O | X | X |
| 이벤트 템플릿 관리 | O | X | X |
| 사용자 관리 | O | X | X |
| 이벤트 생성 | O | O | O |

### 8.3 라우트 가드
- `ProtectedRoute`: 미인증 → `/login` 리다이렉트
- `AdminRoute`: admin 외 → 403 에러 표시
- `PublicRoute`: 인증 완료 → 역할별 메인 페이지 리다이렉트

---

## 9. 등록된 프로덕트 (시드 데이터)

| nId | 프로젝트명 | 약자 | 서비스 범위 | DB 타입 |
|-----|-----------|------|------------|---------|
| 1 | 출조낚시왕 | FH | 국내 | MySQL |
| 2 | DK온라인 | DK/KR, DK/G | 국내, 스팀 | MySQL |
| 3 | 콜오브카오스 | CC | 국내 | MySQL |
| 4 | 아스다스토리 | AD/G | 글로벌 | MySQL |
| 5 | 에이스온라인 | AO/KR, AO/EU, AO/JP | 국내, 유럽, 일본 | MySQL |
| 6 | 라그하임 | LH | 국내 | MySQL |
| 7 | 스키드러시 | SR | 국내 | MySQL |

---

## 10. 기본 계정

| 아이디 | 비밀번호 | 역할 | 설명 |
|--------|----------|------|------|
| `admin` | `admin123` | 관리자 | 전체 관리 권한 |
| `gm01` | `gm123` | GM | 이벤트 생성만 가능 |

---

## 11. 실행 방법

### 11.1 사전 조건
- Node.js 20+ 설치 (https://nodejs.org)
- Git 설치

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
| `update.bat` | 최신 소스 pull + 패키지 업데이트 |
| `start.bat` | 백엔드(4000) + 프론트(5173) 동시 실행 + 브라우저 열기 |
| `stop.bat` | 서버 전부 종료 |

### 11.4 수동 실행
```bash
# 터미널 1 - 백엔드
cd backend && npm run dev     # → http://localhost:4000

# 터미널 2 - 프론트엔드
cd front && npm run dev       # → http://localhost:5173
```

### 11.5 환경변수 (.env)
```
PORT=4000                                          # 서버 포트
JWT_SECRET=event-manager-secret-key-change-in-production  # JWT 시크릿
JWT_EXPIRES_IN=24h                                 # 토큰 만료 시간
```

---

## 12. 상태 관리 (Zustand Stores)

| 스토어 | localStorage 키 | 용도 |
|--------|-----------------|------|
| `useAuthStore` | `strToken` (직접 관리) | 로그인/로그아웃/토큰 |
| `useProductStore` | `em-products` | 프로덕트 CRUD |
| `useEventStore` | `em-events` | 이벤트 템플릿 CRUD |
| `useQueryLogStore` | `em-query-logs` | 이벤트 생성 이력 |

> persist `version` 값을 올리면 해당 스토어의 localStorage가 초기화됩니다.

---

## 13. 향후 계획 (TODO)

### Phase 2 - DB 연동
- [ ] MySQL 서버 구축 (Docker)
- [ ] Prisma 스키마 정의 및 마이그레이션
- [ ] 프로덕트/이벤트/로그 API 구현 (CRUD → DB 저장)
- [ ] localStorage → API 호출로 전환

### Phase 3 - 기능 고도화
- [ ] 실제 쿼리 템플릿 등록 (게임별)
- [ ] 쿼리 실행 전 미리보기/검증
- [ ] 이벤트 생성 이력 검색/필터
- [ ] 이벤트 승인 워크플로 (생성 → 검토 → 실행)
- [ ] 쿼리 직접 실행 기능 (DB 연결)

### Phase 4 - 운영 안정화
- [ ] Docker compose 배포 환경
- [ ] Swagger API 문서 자동화
- [ ] ESLint + Prettier 적용
- [ ] 접속 로그 / 감사 로그
- [ ] 비밀번호 변경 (본인)

---

## 14. 이 문서 활용법

이 문서는 AI 코딩 에이전트가 프로젝트 컨텍스트를 빠르게 파악하기 위한 용도로도 사용됩니다.

**새 세션에서 작업 시작할 때:**
```
docs/SPEC.md 를 읽고 프로젝트 구조를 파악한 후 작업을 진행해주세요.
```

**다른 프로젝트에 활용할 때:**
이 문서의 구조(기술 스택, 코딩 컨벤션, API 명세, 데이터 모델, 화면 명세)를 템플릿으로 복사하여 내용만 교체하면 됩니다.
