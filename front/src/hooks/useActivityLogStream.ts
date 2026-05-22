import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { fnBuildSseApiUrl } from '../api/axiosInstance';

const N_DEBOUNCE_MS = 400;

/**
 * 활동 로그 전용 SSE — 신규 로그 적재 시 콜백(보통 목록 재조회).
 * EventSource는 헤더 불가 → token 쿼리. URL은 `fnBuildSseApiUrl`(Vite /api 프록시 SSE 버퍼링 회피).
 */
export const useActivityLogStream = (objParam: {
  bEnabled: boolean;
  fnOnRefresh: () => void;
}): { bConnected: boolean } => {
  const { bEnabled, fnOnRefresh } = objParam;
  const bIsAuthenticated = useAuthStore((s) => s.bIsAuthenticated);
  const strToken = useAuthStore((s) => s.strToken);
  const [bConnected, setBConnected] = useState(false);
  const refEventSource = useRef<EventSource | null>(null);
  const refDebounce = useRef<number | null>(null);
  const refOnRefresh = useRef(fnOnRefresh);
  refOnRefresh.current = fnOnRefresh;

  useEffect(() => {
    if (refEventSource.current) {
      refEventSource.current.close();
      refEventSource.current = null;
    }
    if (refDebounce.current != null) {
      window.clearTimeout(refDebounce.current);
      refDebounce.current = null;
    }

    if (!bEnabled || !bIsAuthenticated || !strToken) {
      setBConnected(false);
      return;
    }

    const strUrl = fnBuildSseApiUrl(`activity/stream?token=${encodeURIComponent(strToken)}`);
    const objEs = new EventSource(strUrl);
    refEventSource.current = objEs;

    const fnScheduleRefresh = () => {
      if (refDebounce.current != null) {
        window.clearTimeout(refDebounce.current);
      }
      refDebounce.current = window.setTimeout(() => {
        refDebounce.current = null;
        refOnRefresh.current();
      }, N_DEBOUNCE_MS);
    };

    objEs.addEventListener('connected', () => {
      console.log('[SSE 활동] 연결됨');
      setBConnected(true);
    });

    objEs.addEventListener('activity_log_appended', () => {
      fnScheduleRefresh();
    });

    objEs.addEventListener('activity_logs_cleared', () => {
      fnScheduleRefresh();
    });

    objEs.onerror = () => {
      setBConnected(false);
      console.warn('[SSE 활동] 연결 오류 — 재연결 대기');
    };

    return () => {
      if (refDebounce.current != null) {
        window.clearTimeout(refDebounce.current);
        refDebounce.current = null;
      }
      objEs.close();
      refEventSource.current = null;
      setBConnected(false);
    };
  }, [bEnabled, bIsAuthenticated, strToken]);

  return { bConnected };
};
