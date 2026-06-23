import type { IEventInstance, TEventStatus } from '../data/eventInstances';
import { fnAppendUserNotification } from '../data/userNotifications';
import {
  fnCollectEligibleUserIdsForInstance,
  fnIsEventInstanceInvolved,
  fnShouldNotifyEventInstanceProgress,
} from './eventInstanceNotificationEligibility';
import { fnExpandPermissions, fnGetMergedPermissions } from '../data/roles';
import { fnGetUsersWithRoles } from '../data/users';
import { fnBroadcastToUser } from './sseBroadcaster';
import type { IUserNotificationRow } from '../data/userNotifications';

const OBJ_STATUS_LABELS: Record<TEventStatus, string> = {
  event_created: '생성',
  qa_requested: 'QA 반영 요청',
  qa_deployed: 'QA 반영 실행',
  qa_verified: 'QA 확인',
  live_requested: 'LIVE 반영 요청',
  live_deployed: 'LIVE 반영 실행',
  live_verified: '완료',
};

const OBJ_LEGACY_STATUS_LABELS: Record<string, string> = {
  confirm_requested: '컨펌 요청',
  dba_confirmed: 'DBA 컨펌 완료',
};

const fnStatusLabel = (strStatus: TEventStatus | string): string => (
  OBJ_STATUS_LABELS[strStatus as TEventStatus] ?? OBJ_LEGACY_STATUS_LABELS[strStatus] ?? strStatus
);

const fnBuildDashboardQuery = (nInstanceId: number) => ({
  strRoute: '/my-dashboard' as const,
  objQuery: { nInstanceId },
});

const fnPushToUser = async (
  nUserId: number,
  objInput: Parameters<typeof fnAppendUserNotification>[1],
): Promise<void> => {
  const objSaved = await fnAppendUserNotification(nUserId, objInput);
  if (!objSaved) return;
  fnBroadcastToUser(nUserId, 'notification_appended', objSaved);
};

const fnCollectStatusChangedUserIds = (
  objSummary: {
    nId: number;
    strStatus: TEventStatus;
    bPermanentlyRemoved?: boolean;
  },
  setInvolvedUserIds: Set<number>,
): number[] => {
  const objProbe = {
    strStatus: objSummary.strStatus,
    bPermanentlyRemoved: objSummary.bPermanentlyRemoved,
    objCreator: null,
    objConfirmer: null,
    objQaRequester: null,
    objQaDeployer: null,
    objQaVerifier: null,
    objLiveRequester: null,
    objLiveDeployer: null,
    objLiveVerifier: null,
  } as IEventInstance;
  const arrEligible = fnCollectEligibleUserIdsForInstance(objProbe, setInvolvedUserIds);
  return arrEligible;
};

export const fnNotifyInAppInstanceCreated = async (objInstance: IEventInstance): Promise<void> => {
  const nCreatorId = objInstance.objCreator?.nUserId ?? 0;
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  const setExclude = new Set<number>();
  if (nCreatorId > 0) setExclude.add(nCreatorId);
  const arrUserIds = fnCollectEligibleUserIdsForInstance(objInstance, setExclude);
  const objPayload = {
    strLevel: 'info' as const,
    strTitle: '새 이벤트',
    strBody: `${strName} · ${fnStatusLabel(objInstance.strStatus)}`,
    ...fnBuildDashboardQuery(objInstance.nId),
    strSource: 'sse:instance_created',
  };
  await Promise.all(arrUserIds.map((nUserId) => fnPushToUser(nUserId, objPayload)));
};

export const fnNotifyInAppInstanceUpdated = async (objInstance: IEventInstance): Promise<void> => {
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  const objPayload = {
    strLevel: 'info' as const,
    strTitle: '내 이벤트 업데이트',
    strBody: `${strName} · ${fnStatusLabel(objInstance.strStatus)}`,
    ...fnBuildDashboardQuery(objInstance.nId),
    strSource: 'sse:instance_updated',
  };
  const arrUserIds = fnCollectEligibleUserIdsForInstance(objInstance).filter(
    (nUserId) => fnIsEventInstanceInvolved(objInstance, nUserId),
  );
  await Promise.all(arrUserIds.map((nUserId) => fnPushToUser(nUserId, objPayload)));
};

export const fnNotifyInAppInstanceStatusChanged = async (
  setInvolvedUserIds: Set<number>,
  objSummary: {
    nId: number;
    strStatus: TEventStatus;
    strEventName?: string;
    strProductName?: string;
    bPermanentlyRemoved?: boolean;
  },
): Promise<void> => {
  const strName = objSummary.strEventName || `이벤트 #${objSummary.nId}`;
  const strStatus = objSummary.bPermanentlyRemoved
    ? '영구 삭제'
    : fnStatusLabel(objSummary.strStatus);
  const strProduct = objSummary.strProductName ? ` · ${objSummary.strProductName}` : '';
  const objPayload = {
    strLevel: (objSummary.bPermanentlyRemoved ? 'warning' : 'info') as 'warning' | 'info',
    strTitle: '이벤트 상태 변경',
    strBody: `${strName}${strProduct} → ${strStatus}`,
    ...fnBuildDashboardQuery(objSummary.nId),
    strSource: 'sse:instance_status_changed',
  };
  const arrUserIds = fnCollectStatusChangedUserIds(objSummary, setInvolvedUserIds);
  await Promise.all(arrUserIds.map((nUserId) => fnPushToUser(nUserId, objPayload)));
};

export const fnNotifyInAppFromClient = async (
  nUserId: number,
  objInput: Parameters<typeof fnAppendUserNotification>[1],
): Promise<IUserNotificationRow | null> => {
  const objSaved = await fnAppendUserNotification(nUserId, objInput);
  if (!objSaved) return null;
  fnBroadcastToUser(nUserId, 'notification_appended', objSaved);
  return objSaved;
};

export const fnUserShouldReceiveInstanceNotification = (
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
): boolean => {
  const objUser = fnGetUsersWithRoles().find((objRow) => objRow.nId === nUserId);
  if (!objUser) return false;
  const arrPermissions = fnExpandPermissions(
    fnGetMergedPermissions(objUser.arrRoles),
    objUser.arrRoles,
  );
  return fnShouldNotifyEventInstanceProgress(objInstance, nUserId, arrPermissions);
};
