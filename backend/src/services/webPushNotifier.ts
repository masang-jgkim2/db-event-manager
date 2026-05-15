import type { IEventInstance, TEventStatus } from '../data/eventInstances';
import { fnCollectEligibleUserIdsForInstance } from './eventInstanceNotificationEligibility';
import { fnSendWebPushToUserIds } from './webPushService';

const fnBuildDashboardUrl = (nInstanceId: number): string => (
  `/my-dashboard?nInstanceId=${nInstanceId}`
);

export const fnNotifyWebPushInstanceCreated = (objInstance: IEventInstance): void => {
  const nCreatorId = objInstance.objCreator?.nUserId ?? 0;
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  const setExclude = new Set<number>();
  if (nCreatorId > 0) setExclude.add(nCreatorId);
  const arrUserIds = fnCollectEligibleUserIdsForInstance(objInstance, setExclude);
  void fnSendWebPushToUserIds(arrUserIds, {
    strTitle: '새 이벤트',
    strBody: `${strName} · ${objInstance.strStatus}`,
    strUrl: fnBuildDashboardUrl(objInstance.nId),
    strTag: `instance-created-${objInstance.nId}`,
  });
};

export const fnNotifyWebPushInstanceUpdated = (objInstance: IEventInstance): void => {
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  const arrUserIds = fnCollectEligibleUserIdsForInstance(objInstance);
  void fnSendWebPushToUserIds(arrUserIds, {
    strTitle: '내 이벤트 업데이트',
    strBody: `${strName} · ${objInstance.strStatus}`,
    strUrl: fnBuildDashboardUrl(objInstance.nId),
    strTag: `instance-updated-${objInstance.nId}`,
  });
};

export const fnNotifyWebPushInstanceStatusChanged = (
  setInvolvedUserIds: Set<number>,
  objSummary: {
    nId: number;
    strStatus: TEventStatus;
    strEventName?: string;
    strProductName?: string;
    bPermanentlyRemoved?: boolean;
  },
): void => {
  const strName = objSummary.strEventName || `이벤트 #${objSummary.nId}`;
  const strStatus = objSummary.bPermanentlyRemoved ? '영구 삭제' : objSummary.strStatus;
  const strProduct = objSummary.strProductName ? ` · ${objSummary.strProductName}` : '';
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
  const arrUserIds = fnCollectEligibleUserIdsForInstance(objProbe, setInvolvedUserIds);
  void fnSendWebPushToUserIds(arrUserIds, {
    strTitle: '이벤트 상태 변경',
    strBody: `${strName}${strProduct} → ${strStatus}`,
    strUrl: fnBuildDashboardUrl(objSummary.nId),
    strTag: `instance-status-${objSummary.nId}`,
  });
};
