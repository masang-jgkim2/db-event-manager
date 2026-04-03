import apiClient from './axiosInstance';

export type TActivityCategory = 'auth' | 'event' | 'user' | 'ops' | 'other';

export interface IActivityLogRow {
  nId: number;
  dtAt: string;
  strMethod: string;
  strPath: string;
  nStatusCode: number;
  nActorUserId: number | null;
  strActorUserId: string | null;
  arrActorRoles: string[] | null;
  strCategory: TActivityCategory;
}

export interface IActivityLogsResponse {
  bSuccess: boolean;
  arrLogs?: IActivityLogRow[];
  nTotal?: number;
  strMessage?: string;
}

export interface IActivityActorOption {
  nActorUserId: number | null;
  strActorUserId: string | null;
  strLabel: string;
}

export interface IActivityActorsResponse {
  bSuccess: boolean;
  arrActors?: IActivityActorOption[];
  strMessage?: string;
}

export interface IActivityLogsQuery {
  strCategory: 'all' | TActivityCategory;
  nLimit?: number;
  nOffset?: number;
  strDtFrom?: string;
  strDtTo?: string;
  strMethod?: string;
  /** 부분 일치(레거시) */
  strActor?: string;
  bActorNone?: boolean;
  nActorUserId?: number;
  strActorUserId?: string;
  nStatusCode?: number;
}

/** 동일 요청이 동시에 겹치면(React StrictMode 이중 effect 등) HTTP 1회만 수행 */
const mapInflightLogs = new Map<string, Promise<IActivityLogsResponse>>();
let pInflightActors: Promise<IActivityActorsResponse> | null = null;

export const fnApiGetActivityLogs = async (objParams: IActivityLogsQuery): Promise<IActivityLogsResponse> => {
  const objQuery: Record<string, string | number> = {
    strCategory: objParams.strCategory,
    nLimit: objParams.nLimit ?? 100,
    nOffset: objParams.nOffset ?? 0,
  };
  if (objParams.strDtFrom) objQuery.strDtFrom = objParams.strDtFrom;
  if (objParams.strDtTo) objQuery.strDtTo = objParams.strDtTo;
  if (objParams.strMethod) objQuery.strMethod = objParams.strMethod;
  if (objParams.strActor?.trim()) objQuery.strActor = objParams.strActor.trim();
  if (objParams.bActorNone) objQuery.actorNone = 1;
  if (objParams.nActorUserId != null && !Number.isNaN(objParams.nActorUserId)) {
    objQuery.nActorUserId = objParams.nActorUserId;
  }
  if (objParams.strActorUserId != null && objParams.strActorUserId !== '') {
    objQuery.strActorUserId = objParams.strActorUserId;
  }
  if (objParams.nStatusCode != null && !Number.isNaN(objParams.nStatusCode)) {
    objQuery.nStatusCode = objParams.nStatusCode;
  }
  const strKey = JSON.stringify(objQuery);
  const pExisting = mapInflightLogs.get(strKey);
  if (pExisting) {
    return pExisting;
  }
  const p = apiClient
    .get<IActivityLogsResponse>('/activity/logs', { params: objQuery })
    .then((r) => r.data)
    .finally(() => {
      mapInflightLogs.delete(strKey);
    });
  mapInflightLogs.set(strKey, p);
  return p;
};

export const fnApiGetActivityActors = async (): Promise<IActivityActorsResponse> => {
  if (pInflightActors) {
    return pInflightActors;
  }
  pInflightActors = apiClient
    .get<IActivityActorsResponse>('/activity/actors')
    .then((r) => r.data)
    .finally(() => {
      pInflightActors = null;
    });
  return pInflightActors;
};
