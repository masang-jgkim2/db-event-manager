import { useEffect, useRef } from 'react';

// 탭/윈도우가 다시 포커스되거나 visibilitychange 시 fnRefetch 호출
// 다른 페이지에서 수정 후 돌아왔을 때 자동으로 최신 데이터 반영
export const useAutoRefresh = (fnRefetch: () => void, nIntervalMs?: number) => {
  const refFn = useRef(fnRefetch);
  refFn.current = fnRefetch;
  const refBAllowAutoRefetch = useRef(false);

  useEffect(() => {
    const nArmTimer = window.setTimeout(() => {
      refBAllowAutoRefetch.current = true;
    }, 500);

    const fnHandleVisible = () => {
      if (!refBAllowAutoRefetch.current) return;
      if (document.visibilityState === 'visible') {
        refFn.current();
      }
    };
    const fnHandleFocus = () => {
      if (!refBAllowAutoRefetch.current) return;
      refFn.current();
    };

    document.addEventListener('visibilitychange', fnHandleVisible);
    window.addEventListener('focus', fnHandleFocus);

    // 주기적 폴링 (선택적)
    const nTimer = nIntervalMs
      ? window.setInterval(() => refFn.current(), nIntervalMs)
      : undefined;

    return () => {
      window.clearTimeout(nArmTimer);
      refBAllowAutoRefetch.current = false;
      document.removeEventListener('visibilitychange', fnHandleVisible);
      window.removeEventListener('focus', fnHandleFocus);
      if (nTimer !== undefined) clearInterval(nTimer);
    };
  }, [nIntervalMs]);
};
