import type { MessageInstance } from 'antd/es/message/interface';
import type { IEventInstance, TEventStatus, TPermission } from '../types';
import { OBJ_STATUS_CONFIG } from '../types';
import { useNotificationStore, type INotificationInput } from '../stores/useNotificationStore';
import { fnPersistInAppNotification } from '../services/notificationSync';
import {
  fnIsEventInstanceMyAction,
  fnShouldNotifyEventInstanceProgress,
} from './eventInstanceListFilter';

const fnStatusLabel = (strStatus: TEventStatus) => OBJ_STATUS_CONFIG[strStatus]?.strLabel ?? strStatus;

const fnBuildDashboardQuery = (nInstanceId: number) => ({
  strRoute: '/my-dashboard' as const,
  objQuery: { nInstanceId },
});

const fnIsProgressNotificationMuted = (
  objTarget: Pick<IEventInstance, 'strStatus' | 'bPermanentlyRemoved'>,
): boolean => (
  Boolean(objTarget.bPermanentlyRemoved)
  || objTarget.strStatus === 'qa_verified'
);

export { fnIsProgressNotificationMuted };

export const fnPushNotification = (objInput: INotificationInput) => (
  useNotificationStore.getState().fnPush(objInput)
);

export const fnNotifyError = (
  messageApi: MessageInstance,
  strTitle: string,
  strBody?: string,
  objExtra?: Omit<INotificationInput, 'strLevel' | 'strTitle' | 'strBody'>,
) => {
  const strMessage = strBody ? `${strTitle}: ${strBody}` : strTitle;
  messageApi.error(strMessage);
  const objPayload: INotificationInput = {
    strLevel: 'error',
    strTitle,
    strBody,
    ...objExtra,
  };
  void fnPersistInAppNotification(objPayload).then((objSaved) => {
    if (!objSaved) fnPushNotification(objPayload);
  });
};

export const fnNotifySseInstanceCreated = (
  objInstance: IEventInstance,
  nUserId: number,
  arrPermissions: readonly TPermission[],
) => {
  if (objInstance.objCreator?.nUserId === nUserId) return;
  if (!fnShouldNotifyEventInstanceProgress(objInstance, nUserId, arrPermissions)) return;
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  fnPushNotification({
    strLevel: 'info',
    strTitle: '새 이벤트',
    strBody: `${strName} · ${fnStatusLabel(objInstance.strStatus)}`,
    ...fnBuildDashboardQuery(objInstance.nId),
    strSource: 'sse:instance_created',
  });
};

export const fnNotifySseInstanceUpdated = (
  objInstance: IEventInstance,
  nUserId: number,
  arrPermissions: readonly TPermission[],
) => {
  if (fnIsProgressNotificationMuted(objInstance)) return;
  if (!fnShouldNotifyEventInstanceProgress(objInstance, nUserId, arrPermissions)) return;
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  fnPushNotification({
    strLevel: 'info',
    strTitle: '내 이벤트 업데이트',
    strBody: `${strName} · ${fnStatusLabel(objInstance.strStatus)}`,
    ...fnBuildDashboardQuery(objInstance.nId),
    strSource: 'sse:instance_updated',
  });
};

export const fnNotifySseInstanceStatusChanged = (
  objSummary: {
    nId: number;
    strStatus: TEventStatus;
    strEventName?: string;
    strProductName?: string;
    bPermanentlyRemoved?: boolean;
  },
  nUserId: number,
  arrPermissions: readonly TPermission[],
  objInstance?: IEventInstance,
) => {
  if (fnIsProgressNotificationMuted(objSummary)) return;
  const bEligible = objInstance
    ? fnShouldNotifyEventInstanceProgress(objInstance, nUserId, arrPermissions)
    : fnIsEventInstanceMyAction(
      { strStatus: objSummary.strStatus, bPermanentlyRemoved: objSummary.bPermanentlyRemoved },
      arrPermissions,
    );
  if (!bEligible) return;
  const strName = objSummary.strEventName || `이벤트 #${objSummary.nId}`;
  const strStatus = objSummary.bPermanentlyRemoved
    ? '영구 삭제'
    : fnStatusLabel(objSummary.strStatus);
  const strProduct = objSummary.strProductName ? ` · ${objSummary.strProductName}` : '';
  fnPushNotification({
    strLevel: objSummary.bPermanentlyRemoved ? 'warning' : 'info',
    strTitle: '이벤트 상태 변경',
    strBody: `${strName}${strProduct} → ${strStatus}`,
    ...fnBuildDashboardQuery(objSummary.nId),
    strSource: 'sse:instance_status_changed',
  });
};
