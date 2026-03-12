# 외부 PC에서 웹 접근 방법

다른 PC(같은 네트워크 또는 외부)에서 이 프로젝트의 웹 앱에 접속하는 방법입니다.

## 1. 서버 PC에서 할 일

### 1.1 서버 PC의 IP 확인

- **Windows**: `ipconfig` → IPv4 주소 (예: `192.168.0.10`)
- **Mac/Linux**: `ifconfig` 또는 `ip addr` → 해당 네트워크의 IP

아래 설명에서는 이 IP를 `<서버IP>` 로 표기합니다.

### 1.2 백엔드 실행

백엔드는 기본적으로 모든 인터페이스(`0.0.0.0`)에서 수신합니다.

```bash
cd backend
npm run dev
```

- API 주소: `http://<서버IP>:4000`
- `HOST` 환경 변수로 바인딩 주소 변경 가능 (기본값 `0.0.0.0`)

### 1.3 프론트엔드 실행 (개발 서버)

Vite가 `host: true` 로 설정되어 있어 같은 네트워크에서 접근 가능합니다.

**외부 PC에서 API를 쓰려면** 프론트 실행 전에 API 주소를 설정해야 합니다.

- **방법 A – 환경 변수 (권장)**  
  `front` 폴더에 `.env` 파일 생성:

  ```
  VITE_API_URL=http://<서버IP>:4000/api
  ```

  예: 서버 IP가 `192.168.0.10` 이면  
  `VITE_API_URL=http://192.168.0.10:4000/api`

- **방법 B – 실행 시 한 번만**  
  Windows PowerShell:
  ```powershell
  cd front
  $env:VITE_API_URL="http://<서버IP>:4000/api"; npm run dev
  ```
  Mac/Linux:
  ```bash
  cd front
  VITE_API_URL=http://<서버IP>:4000/api npm run dev
  ```

실행 후 콘솔에 표시되는 **Network** 주소(예: `http://192.168.0.10:5173`)로 외부 PC에서 접속할 수 있습니다.

### 1.4 방화벽

- Windows: `4000`, `5173` 포트 인바운드 허용 (고급 보안 방화벽 또는 앱 허용)
- 회사/공유기: 필요 시 포트 포워딩 또는 방화벽 예외

---

## 2. 외부 PC에서 접속

1. 브라우저에서 **웹 주소**로 접속:
   - `http://<서버IP>:5173` (개발 서버)
2. 로그인 후 사용합니다. API 요청은 위에서 설정한 `VITE_API_URL`(즉 `http://<서버IP>:4000/api`)로 갑니다.

---

## 3. 정리

| 구분        | 주소 / 설정 |
|------------|-------------|
| 백엔드 API | `http://<서버IP>:4000` |
| 프론트 (개발) | `http://<서버IP>:5173` |
| 프론트 API 설정 | `VITE_API_URL=http://<서버IP>:4000/api` (`.env` 또는 실행 시) |

- **같은 PC에서만 쓸 때**: 별도 설정 없이 `npm run dev` 만 하면 됩니다 (기본 `localhost`).
- **다른 PC에서 접속할 때**: 서버 PC IP를 확인한 뒤, 위처럼 `VITE_API_URL`을 설정하고 `http://<서버IP>:5173` 으로 접속하면 됩니다.
