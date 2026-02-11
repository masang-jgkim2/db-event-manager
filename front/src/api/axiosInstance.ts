import axios from 'axios';

// API 기본 인스턴스
const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
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

// 응답 인터셉터 - 401 시 토큰 제거
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('strToken');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
