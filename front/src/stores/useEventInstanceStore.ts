import { create } from 'zustand';
import type { IEventInstance, TEventStatus } from '../types';
import {
  fnApiGetInstances, fnApiUpdateStatus,
  fnApiUpdateInstance, fnApiExecuteQuery, fnApiCreateInstance,
} from '../api/eventInstanceApi';

interface IEventInstanceStore {
  arrInstances: IEventInstance[];
  bLoading: boolean;
  strFilter: string;

  // 데이터 로드
  fnFetchInstances: (strFilter?: string) => Promise<void>;
  fnSetFilter: (strFilter: string) => void;

  // 상태 변경 (낙관적 업데이트 + 서버 동기화)
  fnUpdateStatus: (
    nId: number,
    strNextStatus: TEventStatus,
    strComment: string,
    strActorName: string
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  // DB 실행
  fnExecuteQuery: (
    nId: number,
    strEnv: 'qa' | 'live',
    strActorName: string
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance; objExecutionResult?: unknown }>;

  // 인스턴스 수정
  fnUpdateInstance: (
    nId: number,
    objData: Record<string, unknown>
  ) => Promise<{ bSuccess: boolean; strMessage?: string }>;

  // 인스턴스 생성
  fnCreateInstance: (
    objData: Record<string, unknown>
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  // SSE 이벤트 처리 (서버 push → 스토어 동기화)
  fnHandleSseEvent: (
    strEvent: 'instance_updated' | 'instance_status_changed',
    objPayload: unknown
  ) => void;
}

export const useEventInstanceStore = create<IEventInstanceStore>((set, get) => ({
  arrInstances: [],
  bLoading: false,
  strFilter: 'involved',

  fnFetchInstances: async (strFilter?: string) => {
    const strActiveFilter = strFilter ?? get().strFilter;
    set({ bLoading: true });
    try {
      const objResult = await fnApiGetInstances(strActiveFilter);
      if (objResult.bSuccess) {
        set({ arrInstances: objResult.arrInstances });
      }
    } finally {
      set({ bLoading: false });
    }
  },

  fnSetFilter: (strFilter: string) => {
    set({ strFilter });
    get().fnFetchInstances(strFilter);
  },

  fnUpdateStatus: async (nId, strNextStatus, strComment, strActorName) => {
    const objResult = await fnApiUpdateStatus(nId, strNextStatus, strComment, strActorName);
    if (objResult.bSuccess && objResult.objInstance) {
      // 스토어 내 해당 인스턴스 즉시 업데이트 (SSE 도착 전 낙관적 반영)
      set((state) => ({
        arrInstances: state.arrInstances.map((e) =>
          e.nId === nId ? objResult.objInstance : e
        ),
      }));
    }
    return objResult;
  },

  fnExecuteQuery: async (nId, strEnv, strActorName) => {
    try {
      const objResult = await fnApiExecuteQuery(nId, strEnv, strActorName);
      if (objResult.bSuccess && objResult.objInstance) {
        set((state) => ({
          arrInstances: state.arrInstances.map((e) =>
            e.nId === nId ? objResult.objInstance : e
          ),
        }));
      }
      return objResult;
    } catch (error: any) {
      // fnApiExecuteQuery 내부에서 이미 catch하므로 여기까지 오는 경우는 예외적 상황
      return {
        bSuccess: false,
        strMessage: error?.message || '알 수 없는 오류가 발생했습니다.',
      };
    }
  },

  fnUpdateInstance: async (nId, objData) => {
    const objResult = await fnApiUpdateInstance(nId, objData);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrInstances: state.arrInstances.map((e) =>
          e.nId === nId ? objResult.objInstance : e
        ),
      }));
    }
    return objResult;
  },

  fnCreateInstance: async (objData) => {
    const objResult = await fnApiCreateInstance(objData);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrInstances: [objResult.objInstance, ...state.arrInstances],
      }));
    }
    return objResult;
  },

  // SSE로 서버에서 push된 이벤트를 스토어에 반영
  fnHandleSseEvent: (strEvent, objPayload) => {
    if (strEvent === 'instance_updated') {
      // 전체 인스턴스 객체 수신 - 존재하면 교체, 없으면 추가
      const objInstance = objPayload as IEventInstance;
      set((state) => {
        const bExists = state.arrInstances.some((e) => e.nId === objInstance.nId);
        if (bExists) {
          return {
            arrInstances: state.arrInstances.map((e) =>
              e.nId === objInstance.nId ? objInstance : e
            ),
          };
        }
        // 현재 필터가 'all' 또는 'involved'인 경우에만 새 인스턴스 추가
        const strFilter = state.strFilter;
        if (strFilter === 'all' || strFilter === 'involved') {
          return { arrInstances: [objInstance, ...state.arrInstances] };
        }
        return state;
      });
    } else if (strEvent === 'instance_status_changed') {
      // 상태 요약 수신 - 해당 인스턴스의 상태만 업데이트
      const objSummary = objPayload as { nId: number; strStatus: TEventStatus };
      set((state) => ({
        arrInstances: state.arrInstances.map((e) =>
          e.nId === objSummary.nId ? { ...e, strStatus: objSummary.strStatus } : e
        ),
      }));
    }
  },
}));
