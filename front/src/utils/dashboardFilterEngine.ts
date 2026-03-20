/**
 * 위젯용 인스턴스 필터 — GET /api/event-instances 의 filter 쿼리와 동일 규칙(클라이언트 반복)
 */
import type { IEventInstance, TEventStatus } from '../types';
import type { IDashboardFilter, IProductGroup } from '../types/dashboardLayout';

/** 백엔드 eventInstanceController 의 OBJ_STATUS_ACTION_PERMISSIONS 와 동기 */
const OBJ_STATUS_ACTION_PERMISSIONS: Partial<Record<TEventStatus, string[]>> = {
  event_created: ['my_dashboard.request_confirm'],
  confirm_requested: ['my_dashboard.confirm'],
  qa_requested: ['my_dashboard.execute_qa', 'instance.execute_qa'],
  qa_deployed: ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq'],
  qa_verified: ['my_dashboard.request_live', 'my_dashboard.request_qa_rereq'],
  live_requested: ['my_dashboard.execute_live', 'instance.execute_live'],
  live_deployed: ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
  live_verified: ['my_dashboard.request_live_rereq'],
};

function fnInvolvedUser(e: IEventInstance, nUserId: number): boolean {
  return (
    e.objCreator?.nUserId === nUserId ||
    e.objConfirmer?.nUserId === nUserId ||
    e.objQaRequester?.nUserId === nUserId ||
    e.objQaDeployer?.nUserId === nUserId ||
    e.objQaVerifier?.nUserId === nUserId ||
    e.objLiveRequester?.nUserId === nUserId ||
    e.objLiveDeployer?.nUserId === nUserId ||
    e.objLiveVerifier?.nUserId === nUserId
  );
}

function fnExpandProductGroupIds(
  arrGroupIds: string[] | undefined,
  arrGroups: IProductGroup[] | undefined
): number[] {
  if (!arrGroupIds?.length || !arrGroups?.length) return [];
  const setIds = new Set<number>();
  for (const strGid of arrGroupIds) {
    const objG = arrGroups.find((g) => g.strGroupId === strGid);
    objG?.arrProductIds.forEach((n) => setIds.add(n));
  }
  return [...setIds];
}

export interface IDashboardFilterContext {
  nUserId: number;
  arrPermissions: string[];
}

/**
 * arrSource(보통 arrAllInstances)에서 위젯 필터만 적용한 목록
 */
export function fnApplyDashboardFilter(
  arrSource: IEventInstance[],
  objFilter: IDashboardFilter | undefined,
  arrProductGroups: IProductGroup[] | undefined,
  ctx: IDashboardFilterContext
): IEventInstance[] {
  let arr = [...arrSource];
  const bExcludeDeleted = objFilter?.bExcludeDeleted !== false;
  if (bExcludeDeleted) {
    arr = arr.filter((e) => !e.bPermanentlyRemoved);
  }

  const strInst = objFilter?.strInstanceFilter ?? 'all';
  if (strInst === 'involved') {
    arr = arr.filter((e) => fnInvolvedUser(e, ctx.nUserId));
  } else if (strInst === 'mine') {
    arr = arr.filter((e) => e.nCreatedByUserId === ctx.nUserId);
  } else if (strInst === 'my_action') {
    arr = arr.filter((e) => {
      if (e.bPermanentlyRemoved) return false;
      const arrP = OBJ_STATUS_ACTION_PERMISSIONS[e.strStatus];
      return arrP?.some((p) => ctx.arrPermissions.includes(p)) ?? false;
    });
  }

  if (objFilter?.arrStatus?.length) {
    const setS = new Set(objFilter.arrStatus);
    arr = arr.filter((e) => setS.has(e.strStatus));
  }

  const arrPid = objFilter?.arrProductIds;
  if (arrPid?.length) {
    const setP = new Set(arrPid);
    arr = arr.filter((e) => setP.has(e.nProductId));
  }

  const arrExpanded = fnExpandProductGroupIds(objFilter?.arrProductGroupIds, arrProductGroups);
  if (arrExpanded.length) {
    const setG = new Set(arrExpanded);
    arr = arr.filter((e) => setG.has(e.nProductId));
  }

  arr.sort((a, b) => new Date(b.dtCreatedAt).getTime() - new Date(a.dtCreatedAt).getTime());
  return arr;
}

/** 나의 대시보드 상단 KPI「내 처리 대기」— 기존 MyDashboardPage 와 동일 권한 맵 */
export const OBJ_DASHBOARD_ACTION_PERMISSIONS_BY_STATUS: Partial<Record<TEventStatus, string[]>> = {
  event_created: ['my_dashboard.request_confirm'],
  confirm_requested: ['my_dashboard.confirm'],
  qa_requested: ['my_dashboard.execute_qa', 'instance.execute_qa'],
  qa_deployed: ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq'],
  qa_verified: ['my_dashboard.request_live', 'my_dashboard.request_qa_rereq'],
  live_requested: ['my_dashboard.execute_live', 'instance.execute_live'],
  live_deployed: ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
  live_verified: ['my_dashboard.request_live_rereq'],
};

export function fnCountMyActionPending(
  arrAll: IEventInstance[],
  arrPermissions: string[]
): number {
  return arrAll.filter(
    (e) =>
      !e.bPermanentlyRemoved &&
      (OBJ_DASHBOARD_ACTION_PERMISSIONS_BY_STATUS[e.strStatus]?.some((p) => arrPermissions.includes(p)) ??
        false)
  ).length;
}
