# 외부 PC에서 웹 접근 방법

다른 PC(같은 네트워크 또는 외부)에서 이 프로젝트의 웹 앱에 접속하는 방법입니다.

## 0. 로컬·외부 동시 접속 (권장 — start.bat)

**start.bat 한 번**으로 백엔드·프론트를 띄우면, **로컬 접속**과 **외부 IP 접속** 모두 같은 계정으로 로그인·사용할 수 있습니다.

| 접속 주소 | 동작 |
|-----------|------|
| `http://localhost:5173` | API는 `localhost:4000`으로 요청 → 같은 PC 백엔드 사용 |
| `http://<서버IP>:5173` (예: 112.185.196.8:5173) | API는 `<서버IP>:4000`으로 요청 → 같은 백엔드 사용 |

- 프론트가 **접속한 주소(호스트)**에 맞춰 API 주소를 자동으로 쓰므로 **VITE_API_URL 설정 불필요**.
- 백엔드는 한 곳에서만 실행되므로 **데이터(users.json 등)도 한 세트**만 유지됩니다.
- 실행: 프로젝트 루트에서 **start.bat** 실행 후, 로컬은 `http://localhost:5173`, 외부는 `http://<서버IP>:5173` 으로 접속하면 됩니다.

(선택) 데이터 경로 변경: 백엔드 실행 시 `DATA_DIR` 환경 변수. 기본값은 `backend/data`.

---

## 1. 서버 PC에서 할 일

### 1.1 서버 PC의 IP 확인

- **Windows**: `ipconfig` → IPv4 주소 (예: `192.168.0.10`)
- **Mac/Linux**: `ifconfig` 또는 `ip addr` → 해당 네트워크의 IP

아래 설명에서는 이 IP를 `<서버IP>` 로 표기합니다.

### 1.2 서버 실행 (가장 간단)

프로젝트 루트에서:

```
start.bat
```

- 백엔드: `http://<서버IP>:4000` (0.0.0.0 수신)
- 프론트: `http://<서버IP>:5173`
- 로컬·외부 모두 같은 백엔드 사용, 별도 API URL 설정 없음.

### 1.3 수동 실행 (백엔드 / 프론트 따로)

백엔드는 모든 인터페이스(`0.0.0.0`)에서 수신합니다.

```bash
cd backend
npm run dev
```

```bash
cd front
npm run dev
```

- **VITE_API_URL** 은 선택. 미설정 시 접속한 URL(localhost vs `<서버IP>`)에 맞춰 API 주소가 자동 결정됩니다.
- 고정하고 싶으면 `front/.env` 에 `VITE_API_URL=http://<서버IP>:4000/api` 설정.

### 1.4 방화벽

- Windows: `4000`, `5173` 포트 인바운드 허용 (고급 보안 방화벽 또는 앱 허용)
- 회사/공유기: 필요 시 포트 포워딩 또는 방화벽 예외

---

## 2. 접속 방법

| 접속 대상 | 주소 | 비고 |
|-----------|------|------|
| 로컬 (같은 PC) | `http://localhost:5173` | start.bat 실행 후 브라우저에서 접속 |
| 외부 (다른 PC/폰) | `http://<서버IP>:5173` | 같은 네트워크 또는 포트 포워딩 후 접속 |

둘 다 **같은 계정(예: admin / admin123)**으로 로그인 가능합니다.

---

## 3. 로그인 안 될 때 (트러블슈팅)

start.bat으로 한 서버만 쓰는 경우에는 로컬·외부 같은 계정으로 로그인됩니다.  
**다른 서버에서 백엔드를 따로 띄운 경우** 등, IP로 접속 시에만 로그인 안 되면 아래를 참고하세요.

### 방법 A – 서버에서 비밀번호 초기화 (권장)

해당 서버에 접속(원격/SSH 등)한 뒤:

```bash
cd backend
node scripts/reset-password.js admin admin123
```

이후 **해당 서버의 백엔드를 재시작**한 다음, `http://<서버IP>:5173`에서 admin / admin123으로 로그인합니다.

### 방법 B – 브라우저로 한 번만 초기화 (서버 접속 어려울 때)

1. **해당 서버**의 backend에서 환경 변수 설정 후 백엔드 재시작:
   ```bash
   set ALLOW_INIT_ADMIN=true
   set INIT_ADMIN_SECRET=원하는비밀키
   npm run dev
   ```
   (Linux/Mac: `export ALLOW_INIT_ADMIN=true` 등)

2. 다른 PC에서 한 번만 호출 (예: PowerShell):
   ```powershell
   Invoke-RestMethod -Uri "http://<서버IP>:4000/api/admin/init-admin-password" -Method POST -ContentType "application/json" -Body '{"secret":"원하는비밀키"}'
   ```

3. 성공하면 **서버에서** `ALLOW_INIT_ADMIN` 제거 후 백엔드 재시작 (보안상 필수).

4. `http://<서버IP>:5173`에서 admin / admin123으로 로그인합니다.

---

## 4. 정리

| 구분 | 내용 |
|------|------|
| **실행** | 프로젝트 루트에서 **start.bat** → 백엔드(4000) + 프론트(5173) 동시 실행 |
| **로컬 접속** | `http://localhost:5173` — 같은 계정으로 로그인 가능 |
| **외부 접속** | `http://<서버IP>:5173` — 같은 계정으로 로그인 가능 |
| **API 주소** | 접속한 URL에 맞춰 자동 결정 (VITE_API_URL 선택 사항) |
| **데이터** | 백엔드 한 곳만 실행 시 users.json 등 한 세트만 유지 |
