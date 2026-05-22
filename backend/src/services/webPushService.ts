import webpush from 'web-push';
import {
  fnDeleteNotificationSubscriptionByEndpoint,
  fnListAllNotificationSubscriptions,
  fnListNotificationSubscriptionsByUserIds,
  type INotificationSubscriptionRow,
} from '../data/notificationSubscriptions';
import { fnGetUserUiPreferenceEntries } from '../data/userUiPreferences';

export const STR_UI_WEB_PUSH_ENABLED = 'db-event-manager-web-push-enabled';

export interface IWebPushPayload {
  strTitle: string;
  strBody?: string;
  strUrl?: string;
  strTag?: string;
}

const fnReadVapidPublicKey = (): string | null => {
  const strKey = process.env.VAPID_PUBLIC_KEY?.trim();
  return strKey || null;
};

const fnReadVapidPrivateKey = (): string | null => {
  const strKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return strKey || null;
};

const fnReadVapidSubject = (): string => {
  const strSubject = process.env.VAPID_SUBJECT?.trim();
  if (strSubject) return strSubject;
  return 'mailto:dqpm@localhost';
};

let bVapidConfigured = false;

const fnEnsureVapidConfigured = (): boolean => {
  const strPublic = fnReadVapidPublicKey();
  const strPrivate = fnReadVapidPrivateKey();
  if (!strPublic || !strPrivate) return false;
  if (!bVapidConfigured) {
    webpush.setVapidDetails(fnReadVapidSubject(), strPublic, strPrivate);
    bVapidConfigured = true;
  }
  return true;
};

export const fnIsWebPushConfigured = (): boolean => (
  Boolean(fnReadVapidPublicKey() && fnReadVapidPrivateKey())
);

export const fnGetVapidPublicKey = (): string | null => fnReadVapidPublicKey();

export const fnIsUserWebPushEnabled = (nUserId: number): boolean => {
  const objEntries = fnGetUserUiPreferenceEntries(nUserId);
  return objEntries[STR_UI_WEB_PUSH_ENABLED] === '1';
};

const fnToPushJson = (objPayload: IWebPushPayload): string => JSON.stringify(objPayload);

const fnSendToSubscription = async (
  objSub: INotificationSubscriptionRow,
  objPayload: IWebPushPayload,
): Promise<void> => {
  if (!fnEnsureVapidConfigured()) return;
  try {
    await webpush.sendNotification(
      {
        endpoint: objSub.strEndpoint,
        keys: {
          p256dh: objSub.strP256dh,
          auth: objSub.strAuth,
        },
      },
      fnToPushJson(objPayload),
    );
  } catch (err: unknown) {
    const nStatus = (err as { statusCode?: number })?.statusCode;
    if (nStatus === 404 || nStatus === 410) {
      await fnDeleteNotificationSubscriptionByEndpoint(objSub.strEndpoint);
      console.log(`[WebPush] 만료 구독 정리 | user=${objSub.nUserId} | status=${nStatus}`);
      return;
    }
    console.error(`[WebPush] 전송 실패 | user=${objSub.nUserId} | status=${nStatus ?? 'unknown'}`, err);
  }
};

export const fnSendWebPushToUserIds = async (
  arrUserIds: number[],
  objPayload: IWebPushPayload,
): Promise<void> => {
  if (!fnEnsureVapidConfigured() || arrUserIds.length === 0) return;
  const arrTargetUserIds = arrUserIds.filter((nUserId) => fnIsUserWebPushEnabled(nUserId));
  if (arrTargetUserIds.length === 0) return;
  const arrSubs = await fnListNotificationSubscriptionsByUserIds(arrTargetUserIds);
  if (arrSubs.length === 0) return;
  await Promise.all(arrSubs.map((objSub) => fnSendToSubscription(objSub, objPayload)));
};

export const fnSendWebPushToAllExcept = async (
  setExcludeUserIds: Set<number>,
  objPayload: IWebPushPayload,
): Promise<void> => {
  if (!fnEnsureVapidConfigured()) return;
  const arrSubs = await fnListAllNotificationSubscriptions();
  const arrFiltered = arrSubs.filter(
    (objSub) => !setExcludeUserIds.has(objSub.nUserId) && fnIsUserWebPushEnabled(objSub.nUserId),
  );
  if (arrFiltered.length === 0) return;
  await Promise.all(arrFiltered.map((objSub) => fnSendToSubscription(objSub, objPayload)));
};
