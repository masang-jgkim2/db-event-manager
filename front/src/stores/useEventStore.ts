import { create } from 'zustand';
import type { IEventTemplate } from '../types';
import { fnApiGetEvents, fnApiCreateEvent, fnApiUpdateEvent, fnApiDeleteEvent } from '../api/eventApi';

export interface IStoreResult {
  bSuccess: boolean;
  strMessage: string;
}

interface IEventStore {
  arrEvents: IEventTemplate[];
  bLoading: boolean;
  fnFetchEvents: () => Promise<void>;
  fnAddEvent: (objEvent: Omit<IEventTemplate, 'nId' | 'dtCreatedAt'>) => Promise<IStoreResult>;
  fnUpdateEvent: (nId: number, objEvent: Partial<IEventTemplate>) => Promise<IStoreResult>;
  fnDeleteEvent: (nId: number) => Promise<IStoreResult>;
}

export const useEventStore = create<IEventStore>((set) => ({
  arrEvents: [],
  bLoading: false,

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

  fnAddEvent: async (objEvent) => {
    try {
      const result = await fnApiCreateEvent(objEvent as any);
      if (result.bSuccess) {
        set((state) => ({ arrEvents: [...state.arrEvents, result.objEvent] }));
        return { bSuccess: true, strMessage: '이벤트 템플릿이 등록되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '등록에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnUpdateEvent: async (nId, objEvent) => {
    try {
      const result = await fnApiUpdateEvent(nId, objEvent as any);
      if (result.bSuccess) {
        set((state) => ({
          arrEvents: state.arrEvents.map((e) => (e.nId === nId ? result.objEvent : e)),
        }));
        return { bSuccess: true, strMessage: '이벤트 템플릿이 수정되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '수정에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnDeleteEvent: async (nId) => {
    try {
      const result = await fnApiDeleteEvent(nId);
      if (result.bSuccess) {
        set((state) => ({ arrEvents: state.arrEvents.filter((e) => e.nId !== nId) }));
        return { bSuccess: true, strMessage: '이벤트 템플릿이 삭제되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '삭제에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },
}));
