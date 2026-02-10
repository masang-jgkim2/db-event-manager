import { create } from 'zustand';
import type { IQueryLog } from '../types';

interface IQueryLogStore {
  arrLogs: IQueryLog[];
  fnAddLog: (objLog: Omit<IQueryLog, 'nId' | 'dtCreatedAt'>) => void;
  fnClearLogs: () => void;
}

export const useQueryLogStore = create<IQueryLogStore>((set) => ({
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
}));
