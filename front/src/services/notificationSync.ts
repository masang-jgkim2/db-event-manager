import {
  fnApiGetNotifications,
  fnApiPatchNotificationRead,
  fnApiPatchNotificationsReadAll,
  fnApiPostNotification,
} from '../api/notificationsApi';
import { useNotificationStore, type INotification, type INotificationInput } from '../stores/useNotificationStore';

let bServerInAppNotifications = false;

export const fnIsServerInAppNotificationsSync = (): boolean => bServerInAppNotifications;

export const fnPullInAppNotificationsForUser = async (nUserId: number): Promise<void> => {
  if (nUserId <= 0) return;
  try {
    const objRes = await fnApiGetNotifications();
    bServerInAppNotifications = Boolean(objRes.bPersisted);
    if (bServerInAppNotifications && Array.isArray(objRes.arrNotifications)) {
      useNotificationStore.getState().fnReplaceFromServer(objRes.arrNotifications);
      return;
    }
  } catch (err: unknown) {
    console.warn('[알림동기화] 서버 로드 실패(로컬만 사용) |', err);
    bServerInAppNotifications = false;
  }
  await useNotificationStore.persist.rehydrate();
};

export const fnPersistInAppNotification = async (
  objInput: INotificationInput,
): Promise<INotification | null> => {
  if (!bServerInAppNotifications) return null;
  try {
    const objRes = await fnApiPostNotification(objInput);
    if (!objRes.bSuccess || !objRes.objNotification) return null;
    useNotificationStore.getState().fnUpsertFromServer(objRes.objNotification);
    return objRes.objNotification;
  } catch (err: unknown) {
    console.warn('[알림동기화] 서버 저장 실패 |', err);
    return null;
  }
};

export const fnSyncNotificationRead = async (strId: string): Promise<void> => {
  if (!bServerInAppNotifications) return;
  try {
    await fnApiPatchNotificationRead(strId);
  } catch (err: unknown) {
    console.warn('[알림동기화] 읽음 저장 실패 |', err);
  }
};

export const fnSyncNotificationsReadAll = async (): Promise<void> => {
  if (!bServerInAppNotifications) return;
  try {
    await fnApiPatchNotificationsReadAll();
  } catch (err: unknown) {
    console.warn('[알림동기화] 모두 읽음 저장 실패 |', err);
  }
};
