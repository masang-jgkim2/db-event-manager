import type { IEventInstance, TEventStatus } from '../types';

/** 서버 fnGetInstances 와 동일 규칙 — GET 1회(filter=all) 후 클라이언트에서만 필터 */

const fnIsPermanentlyRemoved = (e: { bPermanentlyRemoved?: boolean } | undefined): boolean =>
  Boolean(e?.bPermanentlyRemoved);

const OBJ_STATUS_ACTION_PERMISSIONS: Partial<Record<TEventStatus, string[]>> = {
  event_created: ['my_dashboard.request_qa', 'my_dashboard.request_live'],
  qa_requested: ['my_dashboard.execute_qa', 'instance.execute_qa'],
  qa_deployed: ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq', 'my_dashboard.request_live'],
  live_requested: ['my_dashboard.execute_live', 'instance.execute_live'],
  live_deployed: ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
};

export const fnIsEventInstanceInvolved = (objInstance: IEventInstance, nUserId: number): boolean => {
  if (nUserId <= 0) return false;
  return (
    objInstance.objCreator?.nUserId === nUserId
    || objInstance.objConfirmer?.nUserId === nUserId
    || objInstance.objQaRequester?.nUserId === nUserId
    || objInstance.objQaDeployer?.nUserId === nUserId
    || objInstance.objQaVerifier?.nUserId === nUserId
    || objInstance.objLiveRequester?.nUserId === nUserId
    || objInstance.objLiveDeployer?.nUserId === nUserId
    || objInstance.objLiveVerifier?.nUserId === nUserId
  );
};

export const fnIsEventInstanceMyAction = (
  objInstance: Pick<IEventInstance, 'strStatus' | 'bPermanentlyRemoved'>,
  arrUserPermissions: readonly string[],
): boolean => {
  if (objInstance.bPermanentlyRemoved) return false;
  const arrPerms = OBJ_STATUS_ACTION_PERMISSIONS[objInstance.strStatus as TEventStatus];
  return arrPerms?.some((strPerm) => arrUserPermissions.includes(strPerm)) ?? false;
};

/** 1순위 인앱·푸시: 관여자 또는 현재 상태에서 내 액션이 있는 인스턴스 */
export const fnShouldNotifyEventInstanceProgress = (
  objInstance: IEventInstance,
  nUserId: number,
  arrUserPermissions: readonly string[],
): boolean => (
  fnIsEventInstanceInvolved(objInstance, nUserId)
  || fnIsEventInstanceMyAction(objInstance, arrUserPermissions)
);

const fnSortByCreatedDesc = (arr: IEventInstance[]): IEventInstance[] =>
  [...arr].sort((a, b) => new Date(b.dtCreatedAt).getTime() - new Date(a.dtCreatedAt).getTime());

/**
 * @param arrSource 전체 목록 (서버 filter=all 응답)
 * @param strFilter all | involved | mine | my_action
 */
export const fnApplyEventInstanceListFilter = (
  arrSource: IEventInstance[],
  strFilter: string,
  nUserId: number,
  arrUserPermissions: string[],
): IEventInstance[] => {
  let arrFiltered = [...arrSource];

  if (strFilter === 'involved') {
    arrFiltered = arrFiltered.filter((e) => fnIsEventInstanceInvolved(e, nUserId));
  }

  if (strFilter === 'mine') {
    arrFiltered = arrFiltered.filter((e) => e.nCreatedByUserId === nUserId);
  }

  if (strFilter === 'my_action') {
    arrFiltered = arrFiltered.filter(
      (e) => !fnIsPermanentlyRemoved(e) && fnIsEventInstanceMyAction(e, arrUserPermissions),
    );
  }

  return fnSortByCreatedDesc(arrFiltered);
};
