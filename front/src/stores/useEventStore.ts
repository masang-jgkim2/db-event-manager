import { create } from 'zustand';
import type { IEventTemplate } from '../types';
import { fnApiGetEvents, fnApiCreateEvent, fnApiUpdateEvent, fnApiDeleteEvent } from '../api/eventApi';

interface IEventStore {
  arrEvents: IEventTemplate[];
  bLoading: boolean;
  fnFetchEvents: () => Promise<void>;
  fnAddEvent: (objEvent: Omit<IEventTemplate, 'nId' | 'dtCreatedAt'>) => Promise<boolean>;
  fnUpdateEvent: (nId: number, objEvent: Partial<IEventTemplate>) => Promise<boolean>;
  fnDeleteEvent: (nId: number) => Promise<boolean>;
}

export const useEventStore = create<IEventStore>((set) => ({
  arrEvents: [],
  bLoading: false,

  // 서버에서 이벤트 목록 로드
  fnFetchEvents: async () => {
    set({ bLoading: true });
    try {
      const result = await fnApiGetEvents();
      if (result.bSuccess) {
        set({ arrEvents: result.arrEvents });
      }
    } catch {
      console.error('이벤트 목록 조회 실패');
    } finally {
      set({ bLoading: false });
    }
  },

  // 이벤트 추가
  fnAddEvent: async (objEvent) => {
    try {
      const result = await fnApiCreateEvent(objEvent as any);
      if (result.bSuccess) {
        set((state) => ({ arrEvents: [...state.arrEvents, result.objEvent] }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // 이벤트 수정
  fnUpdateEvent: async (nId, objEvent) => {
    try {
      const result = await fnApiUpdateEvent(nId, objEvent as any);
      if (result.bSuccess) {
        set((state) => ({
          arrEvents: state.arrEvents.map((e) => (e.nId === nId ? result.objEvent : e)),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // 이벤트 삭제
  fnDeleteEvent: async (nId) => {
    try {
      const result = await fnApiDeleteEvent(nId);
      if (result.bSuccess) {
        set((state) => ({ arrEvents: state.arrEvents.filter((e) => e.nId !== nId) }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
