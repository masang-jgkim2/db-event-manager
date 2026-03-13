# E2E 테스트 (페이지 클릭 테스트)

브라우저에서 실제로 로그인·메뉴 클릭·버튼 클릭을 수행하는 테스트입니다.

## 권장: 서버 자동 기동/종료 (테스트 시에만 서버 켜고, 끝나면 자동 종료)

**프로젝트 루트**에서 다음 스크립트를 실행하면, 백엔드·프론트를 띄운 뒤 테스트를 돌리고 **테스트가 끝나면 서버를 자동으로 끕니다.**

```powershell
.\scripts\run-e2e-with-servers.ps1
```

- 백엔드(4000), 프론트(5173)를 기동 → 준비 대기 → E2E 실행 → **종료 후 두 서버 프로세스 자동 종료**
- 포트 4000/5173이 이미 사용 중이면 기존 프로세스를 먼저 종료한 뒤 진행

## 수동으로 서버 띄우고 테스트하기

1. **백엔드**: `cd backend && npm run dev` (포트 4000)
2. **프론트**: `cd front && npm run dev` (포트 5173; 다른 포트면 `PLAYWRIGHT_BASE_URL` 설정)
3. (최초 1회) `cd front && npx playwright install chromium`
4. **테스트 실행**: `cd front && npm run test:e2e`
5. **테스트가 끝난 뒤 서버는 수동으로 종료** (Ctrl+C 등)

- **UI 모드**: `npm run test:e2e:ui`
- **특정 파일만**: `npx playwright test e2e/auth.spec.ts`
- **헤드풀(브라우저 창 보기)**: `npx playwright test --headed`

## 테스트 계정

기본값: `admin` / `admin123` (백엔드 시드와 동일)  
다른 계정으로 돌리려면 환경 변수로 지정:

- `E2E_USER_ID` — 아이디
- `E2E_PASSWORD` — 비밀번호

## 포함된 시나리오

- **auth.spec.ts**: 로그인 페이지 표시, 로그인 성공/실패, 로그아웃 클릭
- **navigation.spec.ts**: 사이드 메뉴 클릭 → 대시보드/프로덕트/이벤트 템플릿/나의 대시보드/DB 접속/사용자/역할 권한 페이지 이동
- **products.spec.ts**: 프로덕트 페이지에서 «추가» 버튼 클릭 → 모달 열기, «취소» 클릭 → 모달 닫기
