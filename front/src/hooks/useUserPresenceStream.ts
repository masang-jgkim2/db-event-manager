import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { fnBuildSseApiUrl } from '../api/axiosInstance';

export interface IUserPresenceSseRow {
  nUserId: number;
  bOnline: boolean;
  strLastSeenAt: string | null;
}

/**
 * 사용자 접속 상태 SSE — 스냅샷·개별 갱신.
 * EventSource는 헤더 불가 → token 쿼리(대시보드·활동 로그와 동일).
 */
export const useUserPresenceStream = (objParam: {
  bEnabled: boolean;
  fnOnSnapshot: (arrRows: IUserPresenceSseRow[]) => void;
  fnOnPresence: (row: IUserPresenceSseRow) => void;
}): { bConnected: boolean } => {
  const { bEnabled, fnOnSnapshot, fnOnPresence } = objParam;
  const bIsAuthenticated = useAuthStore((s) => s.bIsAuthenticated);
  const strToken = useAuthStore((s) => s.strToken);
  const [bConnected, setBConnected] = useState(false);
  const refEventSource = useRef<EventSource | null>(null);
  const refOnSnapshot = useRef(fnOnSnapshot);
  const refOnPresence = useRef(fnOnPresence);
  refOnSnapshot.current = fnOnSnapshot;
  refOnPresence.current = fnOnPresence;

  useEffect(() => {
    if (refEventSource.current) {
      refEventSource.current.close();
      refEventSource.current = null;
    }

    if (!bEnabled || !bIsAuthenticated || !strToken) {
      setBConnected(false);
      return;
    }

    const strUrl = fnBuildSseApiUrl(`users/presence-stream?token=${encodeURIComponent(strToken)}`);
    const objEs = new EventSource(strUrl);
    refEventSource.current = objEs;

    const fnParseRows = (raw: unknown): IUserPresenceSseRow[] | null => {
      if (raw == null || typeof raw !== 'object') return null;
      const arr = (raw as { arrRows?: unknown }).arrRows;
      if (!Array.isArray(arr)) return null;
      return arr.filter(
        (x): x is IUserPresenceSseRow =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as IUserPresenceSseRow).nUserId === 'number' &&
          typeof (x as IUserPresenceSseRow).bOnline === 'boolean',
      );
    };

    objEs.addEventListener('connected', () => {
      console.log('[SSE 사용자 접속] 연결됨');
      setBConnected(true);
    });

    objEs.addEventListener('presence_snapshot', (ev: MessageEvent) => {
      try {
        const obj = JSON.parse(ev.data as string) as unknown;
        const arrRows = fnParseRows(obj);
        if (arrRows != null) {
          refOnSnapshot.current(arrRows);
        }
      } catch {
        console.warn('[SSE 사용자 접속] 스냅샷 파싱 실패');
      }
    });

    objEs.addEventListener('user_presence', (ev: MessageEvent) => {
      try {
        const row = JSON.parse(ev.data as string) as IUserPresenceSseRow;
        if (row && typeof row.nUserId === 'number' && typeof row.bOnline === 'boolean') {
          refOnPresence.current(row);
        }
      } catch {
        console.warn('[SSE 사용자 접속] 이벤트 파싱 실패');
      }
    });

    objEs.onerror = () => {
      setBConnected(false);
      console.warn('[SSE 사용자 접속] 연결 오류 — 재연결 대기');
    };

    return () => {
      objEs.close();
      refEventSource.current = null;
      setBConnected(false);
    };
  }, [bEnabled, bIsAuthenticated, strToken]);

  return { bConnected };
};
