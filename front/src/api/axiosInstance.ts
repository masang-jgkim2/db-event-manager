import axios from 'axios';

/**
 * Vite dev 또는 기본 preview 포트: API는 항상 `/api/...` 상대 경로만 사용.
 * (절대 URL로 :4000을 직접 박으면 방화벽·다른 PC localhost·VITE_API_URL localhost 혼선으로 빈 서버에 붙는 경우가 많음)
 */
function fnUseRelativeApiPath(): boolean {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') return false;
  if (import.meta.env.DEV) return true;
  const strPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return strPort === '4173' || strPort === '5173' || strPort === '5174';
}

/** VITE_API_URL에서 API origin만 추출. localhost인데 UI가 LAN이면 null(상대 경로로 폴백) */
function fnExplicitApiOriginFromEnv(): string | null {
  const strRaw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!strRaw) return null;
  let s = strRaw.replace(/\/$/, '');
  if (s.endsWith('/api')) s = s.slice(0, -4);
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    const strPageHost = window.location.hostname;
    const bPageLocal = strPageHost === 'localhost' || strPageHost === '127.0.0.1';
    try {
      const strEnvHost = new URL(s.includes('://') ? s : `http://${s}`).hostname;
      const bEnvLocal = strEnvHost === 'localhost' || strEnvHost === '127.0.0.1';
      if (bEnvLocal && !bPageLocal) {
        console.warn(
          `[API] VITE_API_URL(${strRaw})은 localhost인데 UI는 ${strPageHost} — 상대 /api 로 요청합니다.`,
        );
        return null;
      }
    } catch {
      return null;
    }
  }
  return s;
}

/**
 * `/api` 아래 경로 전체 (쿼리 포함 가능). 예: `auth/login`, `event-instances?filter=all`
 * 반환: `/api/...` 상대 또는 `http://host:4000/api/...` 절대
 */
export function fnBuildApiUrl(strUnderApi: string): string {
  const s = strUnderApi.replace(/^\//, '');
  const strRelPath = `/api/${s}`;
  const strExplicit = fnExplicitApiOriginFromEnv();
  if (strExplicit) {
    return `${strExplicit.replace(/\/$/, '')}${strRelPath}`;
  }
  if (fnUseRelativeApiPath()) {
    return strRelPath;
  }
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    const strH = window.location.hostname;
    const strProto = window.location.protocol;
    return `${strProto}//${strH}:4000${strRelPath}`;
  }
  return `http://127.0.0.1:4000${strRelPath}`;
}

/** Vite가 `/api`를 프록시할 때 SSE·fetch 스트림 본문이 버퍼링되는 경우가 있어, 동일 호스트의 API 포트로 직접 연결 */
function fnUseDirectSseOrigin(): boolean {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') return false;
  if (import.meta.env.DEV) return true;
  const strPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return strPort === '4173' || strPort === '5173' || strPort === '5174';
}

/** SSE 직접 연결 시 백엔드 포트 — VITE_SSE_PORT → VITE_PROXY_TARGET 파싱 → 기본 4000 */
function fnResolveSseBackendPort(): number {
  const strSse = (import.meta.env.VITE_SSE_PORT as string | undefined)?.trim();
  if (strSse) {
    const n = Number(strSse);
    if (Number.isFinite(n) && n > 0 && n < 65536) return n;
  }
  const strProxy = (import.meta.env.VITE_PROXY_TARGET as string | undefined)?.trim();
  if (strProxy) {
    try {
      const u = new URL(strProxy.includes('://') ? strProxy : `http://${strProxy}`);
      const nFromUrl = Number(u.port);
      if (Number.isFinite(nFromUrl) && nFromUrl > 0) return nFromUrl;
      return u.protocol === 'https:' ? 443 : 80;
    } catch {
      /* */
    }
  }
  return 4000;
}

/**
 * EventSource·스트리밍 fetch 전용 URL (`fnBuildApiUrl`과 달리 프록시 우회).
 * `VITE_API_URL`이 있으면 그 origin 사용. 포트는 `fnResolveSseBackendPort()`.
 */
export function fnBuildSseApiUrl(strUnderApi: string): string {
  const s = strUnderApi.replace(/^\//, '');
  const strPath = `/api/${s}`;
  const strExplicit = fnExplicitApiOriginFromEnv();
  if (strExplicit) {
    return `${strExplicit.replace(/\/$/, '')}${strPath}`;
  }
  if (fnUseDirectSseOrigin()) {
    const strH = window.location.hostname;
    const strProto = window.location.protocol;
    const nSafe = fnResolveSseBackendPort();
    return `${strProto}//${strH}:${nSafe}${strPath}`;
  }
  return fnBuildApiUrl(strUnderApi);
}

const apiClient = axios.create({
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const strRaw = config.url ?? '';
  const strUnderApi = strRaw.startsWith('/') ? strRaw.slice(1) : strRaw;
  config.baseURL = '';
  config.url = fnBuildApiUrl(strUnderApi);

  const strToken = localStorage.getItem('strToken');
  if (strToken) {
    config.headers.Authorization = `Bearer ${strToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('strToken');
    }
    const strServerMsg = error.response?.data?.strMessage;
    if (strServerMsg) {
      error.message = strServerMsg;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
