import type { INotification } from '../stores/useNotificationStore';

const SET_EVENT_PROGRESS_SOURCES = new Set([
  'sse:instance_created',
  'sse:instance_updated',
  'sse:instance_status_changed',
]);

export const fnGetNotificationInstanceId = (objNotification: INotification): number | null => {
  const raw = objNotification.objQuery?.nInstanceId ?? objNotification.objQuery?.nId;
  if (raw == null) return null;
  const nInstanceId = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(nInstanceId) && nInstanceId > 0 ? nInstanceId : null;
};

const fnIsEventProgressNotification = (objNotification: INotification): boolean => (
  objNotification.strSource != null && SET_EVENT_PROGRESS_SOURCES.has(objNotification.strSource)
);

/** 이벤트 진행 알림은 nInstanceId당 최신 1건만 표시. 저장·API 원본 배열은 그대로 둔다. */
export const fnCollapseEventProgressNotifications = (arrNotifications: INotification[]): INotification[] => {
  const arrSorted = [...arrNotifications].sort((objA, objB) => objB.dtAt.localeCompare(objA.dtAt));
  const setSeenInstanceIds = new Set<number>();
  const arrVisible: INotification[] = [];

  for (const objNotification of arrSorted) {
    const nInstanceId = fnGetNotificationInstanceId(objNotification);
    if (fnIsEventProgressNotification(objNotification) && nInstanceId != null) {
      if (setSeenInstanceIds.has(nInstanceId)) continue;
      setSeenInstanceIds.add(nInstanceId);
    }
    arrVisible.push(objNotification);
  }

  return arrVisible;
};

export const fnCountUnreadCollapsedNotifications = (arrNotifications: INotification[]): number => (
  fnCollapseEventProgressNotifications(arrNotifications).filter((objItem) => !objItem.bRead).length
);
