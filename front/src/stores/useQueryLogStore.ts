import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IQueryLog } from '../types';

interface IQueryLogStore {
  arrLogs: IQueryLog[];
  fnAddLog: (objLog: Omit<IQueryLog, 'nId' | 'dtCreatedAt'>) => void;
  fnClearLogs: () => void;
}

export const useQueryLogStore = create<IQueryLogStore>()(
  persist(
    (set) => ({
      arrLogs: [],

      fnAddLog: (objLog) =>
        set((state) => ({
          arrLogs: [
            {
              ...objLog,
              nId: Date.now(),
              dtCreatedAt: new Date().toISOString(),
            },
            ...state.arrLogs,
          ],
        })),

      fnClearLogs: () => set({ arrLogs: [] }),
    }),
    {
      name: 'em-query-logs', // localStorage 키
      version: 2,            // 버전 변경 시 localStorage 초기화
    }
  )
);
