import { create } from 'zustand';
import type { IEventInstance, TEventStatus } from '../types';
import {
  fnApiGetInstances, fnApiUpdateStatus,
  fnApiUpdateInstance, fnApiExecuteQuery, fnApiCreateInstance, fnApiDeleteInstance,
} from '../api/eventInstanceApi';

// localStorage 기반 숨김 ID 목록 관리
const HIDDEN_KEY = 'db-event-manager-hidden-ids';
const fnLoadHiddenIds = (): Set<number> => {
  try {
    const strRaw = localStorage.getItem(HIDDEN_KEY);
    return strRaw ? new Set<number>(JSON.parse(strRaw)) : new Set();
  } catch { return new Set(); }
};
const fnSaveHiddenIds = (setIds: Set<number>) => {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...setIds]));
};

interface IEventInstanceStore {
  // 현재 필터 기준 목록 (테이블 표시용)
  arrInstances: IEventInstance[];
  // 전체 목록 캐시 (통계, SSE 신규 등록 판단용)
  arrAllInstances: IEventInstance[];
  // 숨긴 이벤트 ID 집합 (localStorage 동기화)
  setHiddenIds: Set<number>;
  bLoading: boolean;
  strFilter: string;

  fnFetchInstances: (strFilter?: string) => Promise<void>;
  fnSetFilter: (strFilter: string) => void;
  // 숨기기 / 숨기기 해제
  fnHideInstance: (nId: number) => void;
  fnUnhideInstance: (nId: number) => void;

  fnUpdateStatus: (
    nId: number,
    strNextStatus: TEventStatus,
    strComment: string,
    strActorName: string
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  fnExecuteQuery: (
    nId: number,
    strEnv: 'qa' | 'live',
    strActorName: string
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance; objExecutionResult?: unknown }>;

  fnUpdateInstance: (
    nId: number,
    objData: Record<string, unknown>
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  fnCreateInstance: (
    objData: Record<string, unknown>
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  fnDeleteInstance: (
    nId: number
  ) => Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: IEventInstance }>;

  fnHandleSseEvent: (
    strEvent: 'instance_updated' | 'instance_status_changed' | 'instance_created',
    objPayload: unknown
  ) => void;
}

// 두 목록에 동시에 인스턴스를 upsert하는 헬퍼
const fnUpsertInstance = (
  arrList: IEventInstance[],
  objInstance: IEventInstance
): IEventInstance[] => {
  const bExists = arrList.some((e) => e.nId === objInstance.nId);
  if (bExists) {
    return arrList.map((e) => e.nId === objInstance.nId ? objInstance : e);
  }
  return [objInstance, ...arrList];
};

// 두 목록에서 상태만 업데이트하는 헬퍼
const fnPatchStatus = (
  arrList: IEventInstance[],
  nId: number,
  strStatus: TEventStatus
): IEventInstance[] =>
  arrList.map((e) => e.nId === nId ? { ...e, strStatus } : e);

export const useEventInstanceStore = create<IEventInstanceStore>((set, get) => ({
  arrInstances: [],
  arrAllInstances: [],
  setHiddenIds: fnLoadHiddenIds(),
  bLoading: false,
  strFilter: 'all',  // 기본값: 전체

  fnHideInstance: (nId) => {
    const setNext = new Set(get().setHiddenIds);
    setNext.add(nId);
    fnSaveHiddenIds(setNext);
    set({ setHiddenIds: setNext });
  },

  fnUnhideInstance: (nId) => {
    const setNext = new Set(get().setHiddenIds);
    setNext.delete(nId);
    fnSaveHiddenIds(setNext);
    set({ setHiddenIds: setNext });
  },

  fnFetchInstances: async (strFilter?: string) => {
    const strActiveFilter = strFilter ?? get().strFilter;
    set({ bLoading: true });
    try {
      // 필터된 목록과 전체 목록을 병렬로 가져옴
      const [objFiltered, objAll] = await Promise.all([
        fnApiGetInstances(strActiveFilter),
        strActiveFilter !== 'all' ? fnApiGetInstances('all') : Promise.resolve(null),
      ]);
      if (objFiltered.bSuccess) {
        set({
          arrInstances: objFiltered.arrInstances,
          // 전체 필터면 arrAllInstances도 동일하게, 아니면 별도 조회 결과 사용
          arrAllInstances: objAll?.bSuccess
            ? objAll.arrInstances
            : (strActiveFilter === 'all' ? objFiltered.arrInstances : get().arrAllInstances),
        });
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
      set((state) => ({
        arrInstances: fnUpsertInstance(state.arrInstances, objResult.objInstance!),
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
    }
    return objResult;
  },

  fnExecuteQuery: async (nId, strEnv, strActorName) => {
    try {
      const objResult = await fnApiExecuteQuery(nId, strEnv, strActorName);
      if (objResult.bSuccess && objResult.objInstance) {
        set((state) => ({
          arrInstances: fnUpsertInstance(state.arrInstances, objResult.objInstance!),
          arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
        }));
      }
      return objResult;
    } catch (error: any) {
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
        arrInstances: fnUpsertInstance(state.arrInstances, objResult.objInstance!),
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
    }
    return objResult;
  },

  fnCreateInstance: async (objData) => {
    const objResult = await fnApiCreateInstance(objData);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrInstances: [objResult.objInstance!, ...state.arrInstances],
        arrAllInstances: [objResult.objInstance!, ...state.arrAllInstances],
      }));
    }
    return objResult;
  },

  fnDeleteInstance: async (nId) => {
    const objResult = await fnApiDeleteInstance(nId);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrInstances: fnUpsertInstance(state.arrInstances, objResult.objInstance!),
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
    }
    return objResult;
  },

  // SSE push → 스토어 동기화
  fnHandleSseEvent: (strEvent, objPayload) => {
    if (strEvent === 'instance_created') {
      // 다른 유저가 생성한 신규 이벤트 → 전체 목록과 현재 필터 목록 모두 추가
      const objInstance = objPayload as IEventInstance;
      set((state) => ({
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objInstance),
        // 현재 필터가 'all' 이면 표시 목록에도 추가
        arrInstances: state.strFilter === 'all'
          ? fnUpsertInstance(state.arrInstances, objInstance)
          : state.arrInstances,
      }));
    } else if (strEvent === 'instance_updated') {
      // 관여자에게 오는 전체 객체 업데이트
      const objInstance = objPayload as IEventInstance;
      set((state) => ({
        arrInstances: fnUpsertInstance(state.arrInstances, objInstance),
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objInstance),
      }));
    } else if (strEvent === 'instance_status_changed') {
      // 비관여자에게 오는 상태 요약 업데이트
      const objSummary = objPayload as { nId: number; strStatus: TEventStatus };
      set((state) => ({
        arrInstances: fnPatchStatus(state.arrInstances, objSummary.nId, objSummary.strStatus),
        arrAllInstances: fnPatchStatus(state.arrAllInstances, objSummary.nId, objSummary.strStatus),
      }));
    }
  },
}));
