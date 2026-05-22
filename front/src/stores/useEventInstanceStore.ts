import { create } from 'zustand';
import type { IEventInstance, TEventStatus } from '../types';
import {
  fnApiGetInstances, fnApiUpdateStatus,
  fnApiUpdateInstance, fnApiExecuteQuery, fnApiCreateInstance, fnApiDeleteInstance,
} from '../api/eventInstanceApi';
import { fnScopedStorageSetItem } from '../utils/userScopedStorage';
import { fnApplyEventInstanceListFilter } from '../utils/eventInstanceListFilter';
import { useAuthStore } from './useAuthStore';

/** GET filter=all 1회 + StrictMode 이중 호출 합치기 */
let promiseFetchInstances: Promise<void> | null = null;
let nLastInstancesFetchSuccessAt = 0;
const N_INSTANCES_FETCH_DEBOUNCE_MS = 450;

const STR_HIDDEN_LOGICAL_KEY = 'db-event-manager-hidden-ids';

const fnSaveHiddenIds = (setIds: Set<number>) => {
  fnScopedStorageSetItem(STR_HIDDEN_LOGICAL_KEY, JSON.stringify([...setIds]));
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

/** 비관여자용 SSE 요약(instance_status_changed) — 상태·메타·영구 삭제 플래그 병합 */
const fnSyncArrInstancesToFilter = (
  get: () => IEventInstanceStore,
  set: (partial: Partial<IEventInstanceStore>) => void,
): void => {
  const { strFilter, arrAllInstances } = get();
  const objUser = useAuthStore.getState().user;
  const nUserId = objUser?.nId ?? 0;
  const arrPerms = (objUser?.arrPermissions ?? []) as string[];
  set({
    arrInstances: fnApplyEventInstanceListFilter(arrAllInstances, strFilter, nUserId, arrPerms),
  });
};

const fnPatchInstanceLight = (
  arrList: IEventInstance[],
  objSummary: {
    nId: number;
    strStatus: TEventStatus;
    strEventName?: string;
    strProductName?: string;
    bPermanentlyRemoved?: boolean;
    dtPermanentlyRemovedAt?: string;
  },
): IEventInstance[] =>
  arrList.map((e) => {
    if (e.nId !== objSummary.nId) return e;
    return {
      ...e,
      strStatus: objSummary.strStatus,
      strEventName: objSummary.strEventName ?? e.strEventName,
      strProductName: objSummary.strProductName ?? e.strProductName,
      ...(objSummary.bPermanentlyRemoved !== undefined && { bPermanentlyRemoved: objSummary.bPermanentlyRemoved }),
      ...(objSummary.dtPermanentlyRemovedAt !== undefined && { dtPermanentlyRemovedAt: objSummary.dtPermanentlyRemovedAt }),
    };
  });

export const useEventInstanceStore = create<IEventInstanceStore>((set, get) => ({
  arrInstances: [],
  arrAllInstances: [],
  setHiddenIds: new Set<number>(),
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
    if (promiseFetchInstances != null) return promiseFetchInstances;

    const dtNow = Date.now();
    const { arrAllInstances, strFilter: strStoreFilter } = get();
    if (
      arrAllInstances.length > 0
      && dtNow - nLastInstancesFetchSuccessAt < N_INSTANCES_FETCH_DEBOUNCE_MS
      && strActiveFilter === strStoreFilter
    ) {
      fnSyncArrInstancesToFilter(get, set);
      return;
    }

    promiseFetchInstances = (async () => {
      set({ bLoading: true });
      try {
        // 서버는 filter=all 한 번으로 전체 전달 — mine/involved 등은 클라에서 동일 규칙 적용(활동 로그 GET 2배 제거)
        const objAll = await fnApiGetInstances('all');
        if (!objAll.bSuccess) return;
        const objUser = useAuthStore.getState().user;
        const nUserId = objUser?.nId ?? 0;
        const arrPerms = (objUser?.arrPermissions ?? []) as string[];
        const arrVisible = fnApplyEventInstanceListFilter(
          objAll.arrInstances,
          strActiveFilter,
          nUserId,
          arrPerms,
        );
        set({
          arrAllInstances: objAll.arrInstances,
          arrInstances: arrVisible,
        });
        nLastInstancesFetchSuccessAt = Date.now();
      } finally {
        set({ bLoading: false });
        promiseFetchInstances = null;
      }
    })();
    return promiseFetchInstances;
  },

  fnSetFilter: (strFilter: string) => {
    set({ strFilter });
    const arrAll = get().arrAllInstances;
    if (arrAll.length === 0) {
      void get().fnFetchInstances(strFilter);
      return;
    }
    fnSyncArrInstancesToFilter(get, set);
  },

  fnUpdateStatus: async (nId, strNextStatus, strComment, strActorName) => {
    const objResult = await fnApiUpdateStatus(nId, strNextStatus, strComment, strActorName);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
      fnSyncArrInstancesToFilter(get, set);
    }
    return objResult;
  },

  fnExecuteQuery: async (nId, strEnv, strActorName) => {
    try {
      const objResult = await fnApiExecuteQuery(nId, strEnv, strActorName);
      if (objResult.bSuccess && objResult.objInstance) {
        set((state) => ({
          arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
        }));
        fnSyncArrInstancesToFilter(get, set);
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
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
      fnSyncArrInstancesToFilter(get, set);
    }
    return objResult;
  },

  fnCreateInstance: async (objData) => {
    const objResult = await fnApiCreateInstance(objData);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrAllInstances: [objResult.objInstance!, ...state.arrAllInstances],
      }));
      fnSyncArrInstancesToFilter(get, set);
    }
    return objResult;
  },

  fnDeleteInstance: async (nId) => {
    const objResult = await fnApiDeleteInstance(nId);
    if (objResult.bSuccess && objResult.objInstance) {
      set((state) => ({
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objResult.objInstance!),
      }));
      fnSyncArrInstancesToFilter(get, set);
    }
    return objResult;
  },

  // SSE push → arrAllInstances 갱신 후 현재 필터로 표시 목록 재계산
  fnHandleSseEvent: (strEvent, objPayload) => {
    if (strEvent === 'instance_created') {
      const objInstance = objPayload as IEventInstance;
      set((state) => ({
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objInstance),
      }));
      fnSyncArrInstancesToFilter(get, set);
    } else if (strEvent === 'instance_updated') {
      const objInstance = objPayload as IEventInstance;
      set((state) => ({
        arrAllInstances: fnUpsertInstance(state.arrAllInstances, objInstance),
      }));
      fnSyncArrInstancesToFilter(get, set);
    } else if (strEvent === 'instance_status_changed') {
      const objSummary = objPayload as {
        nId: number;
        strStatus: TEventStatus;
        strEventName?: string;
        strProductName?: string;
        bPermanentlyRemoved?: boolean;
        dtPermanentlyRemovedAt?: string;
      };
      set((state) => ({
        arrAllInstances: fnPatchInstanceLight(state.arrAllInstances, objSummary),
      }));
      fnSyncArrInstancesToFilter(get, set);
    }
  },
}));
