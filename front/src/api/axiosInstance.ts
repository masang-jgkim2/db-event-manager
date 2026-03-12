import axios from 'axios';

// API 기본 인스턴스 (외부 접근 시 .env에 VITE_API_URL=http://<서버IP>:4000/api 설정)
// DB 쿼리 실행은 수십 초가 걸릴 수 있으므로 timeout을 충분히 설정
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 120000,  // 2분 (DB 쿼리 실행 대비)
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 토큰 자동 삽입
apiClient.interceptors.request.use(
  (config) => {
    const strToken = localStorage.getItem('strToken');
    if (strToken) {
      config.headers.Authorization = `Bearer ${strToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 - 오류 시 서버 메시지를 error.message로 정규화
// axios는 4xx/5xx를 throw하므로 서버의 strMessage를 직접 꺼내야 함
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('strToken');
    }
    // 서버 응답의 strMessage를 error.message로 올림 (호출부에서 catch 시 바로 사용 가능)
    const strServerMsg = error.response?.data?.strMessage;
    if (strServerMsg) {
      error.message = strServerMsg;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
