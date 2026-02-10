import { create } from 'zustand';
import type { IQueryLog } from '../types';

// 쿼리 로그 관리 스토어
interface IQueryLogStore {
  arrLogs: IQueryLog[];
  fnAddLog: (objLog: Omit<IQueryLog, 'nId' | 'dtCreatedAt'>) => void;
  fnClearLogs: () => void;
}

export const useQueryLogStore = create<IQueryLogStore>((set) => ({
  arrLogs: [],

  // 로그 추가
  fnAddLog: (objLog) =>
    set((state) => ({
      arrLogs: [
        {
          ...objLog,
          nId: Date.now(),
          dtCreatedAt: new Date().toISOString(),
        },
        ...state.arrLogs, // 최신 것이 위로
      ],
    })),

  // 로그 초기화
  fnClearLogs: () => set({ arrLogs: [] }),
}));
