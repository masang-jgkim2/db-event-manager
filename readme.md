# 이벤트 매니저 & DB 쿼리 매니저

## 개요
반복적인 이벤트 운영과 단순 쿼리 제작을 자동화하는 웹 애플리케이션

## 대상 사용자
- GM (게임 마스터)
- 기획자
- 권한이 있는 누구나

## 핵심 기능
1. **프로덕트 선택** - 운영 중인 프로덕트(게임/서비스) 선택
2. **이벤트 선택** - 미리 정의된 이벤트 유형 중 선택
3. **파라미터 입력** - 이벤트에 필요한 값 입력 (아이템, 날짜, 삭제 아이템 등)
4. **쿼리 자동 생성** - 입력값 기반 DB 쿼리 자동 생성

## 기술 스택

### Frontend
- React + TypeScript
- Vite (빌드 도구)
- Ant Design (UI 라이브러리)
- Zustand (상태 관리)
- Axios (HTTP 클라이언트)

### Backend
- Node.js + TypeScript
- Express.js
- Prisma (ORM)
- JWT + bcrypt (인증)
- Zod (유효성 검증)

### Database
- MySQL

### 인프라 / 기타
- Docker + docker-compose
- Swagger (API 문서)
- ESLint + Prettier (코드 품질)

## 폴더 구조
```
/workspace
├── front/          # React + Vite + Ant Design
├── backend/        # Express + Prisma
├── db/             # SQL 스키마, 마이그레이션, 시드 데이터
├── design/         # 와이어프레임, UI 스펙
├── docker-compose.yml
└── readme.md
```
