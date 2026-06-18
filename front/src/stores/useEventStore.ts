import { create } from 'zustand';
import type { IEventTemplate, TTemplateStatus } from '../types';
import { fnApiGetEvents, fnApiCreateEvent, fnApiUpdateEvent, fnApiDeleteEvent, fnApiPatchEventStatus, fnApiUpdateEventQuery } from '../api/eventApi';

let promiseFetchEvents: Promise<void> | null = null;
let nLastEventsSuccessAt = 0;
const N_FETCH_DEBOUNCE_MS = 450;

export interface IStoreResult {
  bSuccess: boolean;
  strMessage: string;
}

interface IEventStore {
  arrEvents: IEventTemplate[];
  bLoading: boolean;
  fnFetchEvents: () => Promise<void>;
  fnAddEvent: (objEvent: Omit<IEventTemplate, 'nId' | 'dtCreatedAt'>) => Promise<IStoreResult>;
  fnUpdateEvent: (nId: number, objEvent: Partial<IEventTemplate>) => Promise<IStoreResult & { bReapprovalRequired?: boolean }>;
  fnDeleteEvent: (nId: number) => Promise<IStoreResult>;
  fnPatchEventStatus: (nId: number, strNextStatus: TTemplateStatus, strComment?: string) => Promise<IStoreResult & { objEvent?: IEventTemplate }>;
  fnUpdateEventQuery: (nId: number, objQuery: Record<string, unknown>) => Promise<IStoreResult & { objEvent?: IEventTemplate }>;
}

export const useEventStore = create<IEventStore>((set, get) => ({
  arrEvents: [],
  bLoading: false,

  fnFetchEvents: async () => {
    if (promiseFetchEvents != null) return promiseFetchEvents;
    const dtNow = Date.now();
    const arr = get().arrEvents;
    if (arr.length > 0 && dtNow - nLastEventsSuccessAt < N_FETCH_DEBOUNCE_MS) return;

    promiseFetchEvents = (async () => {
      set({ bLoading: true });
      try {
        const result = await fnApiGetEvents();
        if (result.bSuccess) {
          set({ arrEvents: result.arrEvents });
          nLastEventsSuccessAt = Date.now();
        }
      } catch {
        console.error('쿼리 템플릿 목록 조회 실패');
      } finally {
        set({ bLoading: false });
        promiseFetchEvents = null;
      }
    })();
    return promiseFetchEvents;
  },

  fnAddEvent: async (objEvent) => {
    try {
      const result = await fnApiCreateEvent(objEvent as any);
      if (result.bSuccess) {
        set((state) => ({ arrEvents: [...state.arrEvents, result.objEvent] }));
        return { bSuccess: true, strMessage: '쿼리 템플릿이 등록되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '등록에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnUpdateEvent: async (nId, objEvent) => {
    try {
      const result = await fnApiUpdateEvent(nId, objEvent as any);
      if (result.bSuccess && result.objEvent) {
        set((state) => ({
          arrEvents: state.arrEvents.map((e) => (e.nId === nId ? result.objEvent as IEventTemplate : e)),
        }));
        const strMessage = result.bReapprovalRequired
          ? '쿼리·세트가 변경되어 DBA 재승인이 필요합니다.'
          : '쿼리 템플릿이 수정되었습니다.';
        return { bSuccess: true, strMessage, bReapprovalRequired: result.bReapprovalRequired };
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
        return { bSuccess: true, strMessage: '쿼리 템플릿이 삭제되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '삭제에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnPatchEventStatus: async (nId, strNextStatus, strComment) => {
    try {
      const result = await fnApiPatchEventStatus(nId, strNextStatus, strComment);
      if (result.bSuccess && result.objEvent) {
        set((state) => ({
          arrEvents: state.arrEvents.map((e) => (e.nId === nId ? result.objEvent : e)),
        }));
        return { bSuccess: true, strMessage: '상태가 변경되었습니다.', objEvent: result.objEvent };
      }
      return { bSuccess: false, strMessage: result.strMessage || '상태 변경에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnUpdateEventQuery: async (nId, objQuery) => {
    try {
      const result = await fnApiUpdateEventQuery(nId, objQuery);
      if (result.bSuccess && result.objEvent) {
        const objEvent = result.objEvent as IEventTemplate;
        set((state) => ({
          arrEvents: state.arrEvents.map((e) => (e.nId === nId ? objEvent : e)),
        }));
        return { bSuccess: true, strMessage: '쿼리가 수정되었습니다.', objEvent };
      }
      return { bSuccess: false, strMessage: result.strMessage || '쿼리 수정에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },
}));
