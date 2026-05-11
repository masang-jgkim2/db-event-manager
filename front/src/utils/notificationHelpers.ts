import type { MessageInstance } from 'antd/es/message/interface';
import type { IEventInstance, TEventStatus } from '../types';
import { OBJ_STATUS_CONFIG } from '../types';
import { useNotificationStore, type INotificationInput } from '../stores/useNotificationStore';

const fnStatusLabel = (strStatus: TEventStatus) => OBJ_STATUS_CONFIG[strStatus]?.strLabel ?? strStatus;

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
  fnPushNotification({
    strLevel: 'error',
    strTitle,
    strBody,
    ...objExtra,
  });
};

export const fnNotifySseInstanceCreated = (objInstance: IEventInstance) => {
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  fnPushNotification({
    strLevel: 'info',
    strTitle: '새 이벤트',
    strBody: `${strName} · ${fnStatusLabel(objInstance.strStatus)}`,
    strRoute: '/my-dashboard',
    objQuery: { nInstanceId: objInstance.nId },
    strSource: 'sse:instance_created',
  });
};

export const fnNotifySseInstanceStatusChanged = (objSummary: {
  nId: number;
  strStatus: TEventStatus;
  strEventName?: string;
  strProductName?: string;
  bPermanentlyRemoved?: boolean;
}) => {
  const strName = objSummary.strEventName || `이벤트 #${objSummary.nId}`;
  const strStatus = objSummary.bPermanentlyRemoved
    ? '영구 삭제'
    : fnStatusLabel(objSummary.strStatus);
  const strProduct = objSummary.strProductName ? ` · ${objSummary.strProductName}` : '';
  fnPushNotification({
    strLevel: objSummary.bPermanentlyRemoved ? 'warning' : 'info',
    strTitle: '이벤트 상태 변경',
    strBody: `${strName}${strProduct} → ${strStatus}`,
    strRoute: '/my-dashboard',
    objQuery: { nInstanceId: objSummary.nId },
    strSource: 'sse:instance_status_changed',
  });
};
