import { useEffect, useRef, useState } from 'react';
import { useEventInstanceStore } from '../stores/useEventInstanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { STR_API_BASE } from '../api/axiosInstance';

// SSE 연결 및 이벤트 인스턴스 실시간 동기화 훅
// MainLayout에 한 번만 마운트하면 앱 전체에서 동작
export const useEventStream = () => {
  const refEventSource = useRef<EventSource | null>(null);
  // bConnected를 ref 대신 state로 관리해 헤더에 실시간 반영
  const [bConnected, setBConnected] = useState(false);

  const bIsAuthenticated = useAuthStore((s) => s.bIsAuthenticated);
  const strToken = useAuthStore((s) => s.strToken);
  const fnHandleSseEvent = useEventInstanceStore((s) => s.fnHandleSseEvent);

  useEffect(() => {
    if (!bIsAuthenticated || !strToken) {
      if (refEventSource.current) {
        refEventSource.current.close();
        refEventSource.current = null;
        setBConnected(false);
      }
      return;
    }

    // 기존 연결이 열려있으면 재사용
    if (refEventSource.current?.readyState === EventSource.OPEN) return;

    // SSE는 헤더를 직접 설정할 수 없으므로 토큰을 쿼리스트링으로 전달
    const strUrl = `${STR_API_BASE}/event-instances/stream?token=${strToken}`;
    const objEs = new EventSource(strUrl);
    refEventSource.current = objEs;

    objEs.addEventListener('connected', () => {
      console.log('[SSE] 연결됨');
      setBConnected(true);
    });

    // 다른 유저가 생성한 신규 이벤트 수신
    objEs.addEventListener('instance_created', (e: MessageEvent) => {
      try {
        const objInstance = JSON.parse(e.data);
        fnHandleSseEvent('instance_created', objInstance);
      } catch {
        console.warn('[SSE] instance_created 파싱 실패');
      }
    });

    // 관여한 인스턴스 전체 업데이트
    objEs.addEventListener('instance_updated', (e: MessageEvent) => {
      try {
        const objInstance = JSON.parse(e.data);
        fnHandleSseEvent('instance_updated', objInstance);
      } catch {
        console.warn('[SSE] instance_updated 파싱 실패');
      }
    });

    // 상태 변경 요약 (관여하지 않은 이벤트)
    objEs.addEventListener('instance_status_changed', (e: MessageEvent) => {
      try {
        const objSummary = JSON.parse(e.data);
        fnHandleSseEvent('instance_status_changed', objSummary);
      } catch {
        console.warn('[SSE] instance_status_changed 파싱 실패');
      }
    });

    objEs.onerror = () => {
      setBConnected(false);
      console.warn('[SSE] 연결 오류 - 자동 재연결 대기');
    };

    return () => {
      objEs.close();
      refEventSource.current = null;
      setBConnected(false);
    };
  }, [bIsAuthenticated, strToken, fnHandleSseEvent]);

  return { bConnected };
};
