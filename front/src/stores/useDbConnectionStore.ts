import { create } from 'zustand';
import type { IDbConnection } from '../types';
import { fnApiGetDbConnections } from '../api/dbConnectionApi';

/** 동시·짧은 연속 GET 합침 — 활동 로그·서버 부하·StrictMode 이중 effect 완화 */
let promiseFetch: Promise<void> | null = null;
let nLastSuccessAt = 0;
const N_FETCH_DEBOUNCE_MS = 450;

interface IDbConnectionStore {
  arrDbConnections: IDbConnection[];
  bLoading: boolean;
  fnFetchDbConnections: () => Promise<void>;
}

export const useDbConnectionStore = create<IDbConnectionStore>((set, get) => ({
  arrDbConnections: [],
  bLoading: false,

  fnFetchDbConnections: async () => {
    if (promiseFetch != null) return promiseFetch;
    const dtNow = Date.now();
    const arr = get().arrDbConnections;
    if (arr.length > 0 && dtNow - nLastSuccessAt < N_FETCH_DEBOUNCE_MS) return;

    promiseFetch = (async () => {
      set({ bLoading: true });
      try {
        const res = await fnApiGetDbConnections();
        if (res?.bSuccess && Array.isArray(res.arrDbConnections)) {
          set({ arrDbConnections: res.arrDbConnections });
          nLastSuccessAt = Date.now();
        }
      } catch {
        console.error('[DB접속] 목록 조회 실패');
      } finally {
        set({ bLoading: false });
        promiseFetch = null;
      }
    })();
    return promiseFetch;
  },
}));
