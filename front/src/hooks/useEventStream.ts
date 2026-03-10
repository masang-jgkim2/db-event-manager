import { useEffect, useRef } from 'react';
import { useEventInstanceStore } from '../stores/useEventInstanceStore';
import { useAuthStore } from '../stores/useAuthStore';

const STR_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// SSE 연결 및 이벤트 인스턴스 실시간 동기화 훅
// MainLayout에 한 번만 마운트하면 앱 전체에서 동작
export const useEventStream = () => {
  const refEventSource = useRef<EventSource | null>(null);
  const bIsAuthenticated = useAuthStore((s) => s.bIsAuthenticated);
  const strToken = useAuthStore((s) => s.strToken);
  const fnHandleSseEvent = useEventInstanceStore((s) => s.fnHandleSseEvent);

  useEffect(() => {
    if (!bIsAuthenticated || !strToken) {
      // 로그아웃 시 기존 연결 종료
      if (refEventSource.current) {
        refEventSource.current.close();
        refEventSource.current = null;
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
    });

    // 관여한 인스턴스 전체 업데이트 (내가 관여한 이벤트)
    objEs.addEventListener('instance_updated', (e: MessageEvent) => {
      try {
        const objInstance = JSON.parse(e.data);
        fnHandleSseEvent('instance_updated', objInstance);
      } catch {
        console.warn('[SSE] instance_updated 파싱 실패');
      }
    });

    // 상태 변경 요약 (관여하지 않은 이벤트 - "전체 이벤트" 필터용)
    objEs.addEventListener('instance_status_changed', (e: MessageEvent) => {
      try {
        const objSummary = JSON.parse(e.data);
        fnHandleSseEvent('instance_status_changed', objSummary);
      } catch {
        console.warn('[SSE] instance_status_changed 파싱 실패');
      }
    });

    objEs.onerror = () => {
      // 연결 오류 시 EventSource가 자동 재연결을 시도함
      // 명시적으로 끊기 전까지는 재연결 유지
      console.warn('[SSE] 연결 오류 - 자동 재연결 대기');
    };

    return () => {
      objEs.close();
      refEventSource.current = null;
    };
  }, [bIsAuthenticated, strToken, fnHandleSseEvent]);

  return {
    bConnected: refEventSource.current?.readyState === EventSource.OPEN,
  };
};
