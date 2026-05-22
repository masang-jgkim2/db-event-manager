import type { IEventInstance, TEventStatus } from '../data/eventInstances';
import { fnExpandPermissions, fnGetMergedPermissions } from '../data/roles';
import { fnGetUsersWithRoles } from '../data/users';

/** 나의 대시보드 `my_action` 필터와 동일 — front `eventInstanceListFilter.ts` 와 맞출 것 */
const OBJ_STATUS_ACTION_PERMISSIONS: Partial<Record<TEventStatus, readonly string[]>> = {
  event_created: ['my_dashboard.request_confirm'],
  confirm_requested: ['my_dashboard.confirm'],
  qa_requested: ['my_dashboard.execute_qa', 'instance.execute_qa'],
  qa_deployed: ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq', 'my_dashboard.request_live'],
  live_requested: ['my_dashboard.execute_live', 'instance.execute_live'],
  live_deployed: ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
};

export const fnShouldSkipEventInstanceProgressNotification = (
  objInstance: Pick<IEventInstance, 'strStatus' | 'bPermanentlyRemoved'>,
): boolean => (
  Boolean(objInstance.bPermanentlyRemoved)
  || objInstance.strStatus === 'qa_verified'
);

export const fnIsEventInstanceInvolved = (
  objInstance: Pick<IEventInstance, 'objCreator' | 'objConfirmer' | 'objQaRequester' | 'objQaDeployer' | 'objQaVerifier' | 'objLiveRequester' | 'objLiveDeployer' | 'objLiveVerifier'>,
  nUserId: number,
): boolean => {
  if (nUserId <= 0) return false;
  const arrActors = [
    objInstance.objCreator,
    objInstance.objConfirmer,
    objInstance.objQaRequester,
    objInstance.objQaDeployer,
    objInstance.objQaVerifier,
    objInstance.objLiveRequester,
    objInstance.objLiveDeployer,
    objInstance.objLiveVerifier,
  ];
  return arrActors.some((objActor) => objActor?.nUserId === nUserId);
};

export const fnIsEventInstanceMyAction = (
  objInstance: Pick<IEventInstance, 'strStatus' | 'bPermanentlyRemoved'>,
  arrPermissions: readonly string[],
): boolean => {
  if (objInstance.bPermanentlyRemoved) return false;
  const arrPerms = OBJ_STATUS_ACTION_PERMISSIONS[objInstance.strStatus];
  if (!arrPerms) return false;
  return arrPerms.some((strPerm) => arrPermissions.includes(strPerm));
};

/** 1순위: 단계 처리자로 이미 관여했거나, 현재 상태에서 내가 할 액션이 있는 인스턴스 */
export const fnShouldNotifyEventInstanceProgress = (
  objInstance: Pick<
    IEventInstance,
    | 'strStatus'
    | 'bPermanentlyRemoved'
    | 'objCreator'
    | 'objConfirmer'
    | 'objQaRequester'
    | 'objQaDeployer'
    | 'objQaVerifier'
    | 'objLiveRequester'
    | 'objLiveDeployer'
    | 'objLiveVerifier'
  >,
  nUserId: number,
  arrPermissions: readonly string[],
): boolean => (
  fnIsEventInstanceInvolved(objInstance, nUserId)
  || fnIsEventInstanceMyAction(objInstance, arrPermissions)
);

export const fnCollectEligibleUserIdsForInstance = (
  objInstance: Pick<
    IEventInstance,
    | 'strStatus'
    | 'bPermanentlyRemoved'
    | 'objCreator'
    | 'objConfirmer'
    | 'objQaRequester'
    | 'objQaDeployer'
    | 'objQaVerifier'
    | 'objLiveRequester'
    | 'objLiveDeployer'
    | 'objLiveVerifier'
  >,
  setExcludeUserIds?: Set<number>,
): number[] => {
  const arrEligible: number[] = [];
  for (const objUser of fnGetUsersWithRoles()) {
    if (setExcludeUserIds?.has(objUser.nId)) continue;
    const arrRaw = fnGetMergedPermissions(objUser.arrRoles);
    const arrPermissions = fnExpandPermissions(arrRaw, objUser.arrRoles);
    if (fnShouldNotifyEventInstanceProgress(objInstance, objUser.nId, arrPermissions)) {
      arrEligible.push(objUser.nId);
    }
  }
  return arrEligible;
};
