import type { IEventInstance, TEventStatus } from '../types';

/** 서버 fnGetInstances 와 동일 규칙 — GET 1회(filter=all) 후 클라이언트에서만 필터 */

const fnIsPermanentlyRemoved = (e: { bPermanentlyRemoved?: boolean } | undefined): boolean =>
  Boolean(e?.bPermanentlyRemoved);

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
    arrFiltered = arrFiltered.filter(
      (e) =>
        e.objCreator?.nUserId === nUserId
        || e.objConfirmer?.nUserId === nUserId
        || e.objQaRequester?.nUserId === nUserId
        || e.objQaDeployer?.nUserId === nUserId
        || e.objQaVerifier?.nUserId === nUserId
        || e.objLiveRequester?.nUserId === nUserId
        || e.objLiveDeployer?.nUserId === nUserId
        || e.objLiveVerifier?.nUserId === nUserId,
    );
  }

  if (strFilter === 'mine') {
    arrFiltered = arrFiltered.filter((e) => e.nCreatedByUserId === nUserId);
  }

  if (strFilter === 'my_action') {
    arrFiltered = arrFiltered.filter((e) => {
      if (fnIsPermanentlyRemoved(e)) return false;
      const arrPerms = OBJ_STATUS_ACTION_PERMISSIONS[e.strStatus as TEventStatus];
      return arrPerms?.some((p) => arrUserPermissions.includes(p)) ?? false;
    });
  }

  return fnSortByCreatedDesc(arrFiltered);
};
