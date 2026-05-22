import { fnLoadJson, fnSaveJson } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import {
  fnMysqlDeleteNotificationSubscription,
  fnMysqlDeleteNotificationSubscriptionByEndpoint,
  fnMysqlListAllNotificationSubscriptions,
  fnMysqlListNotificationSubscriptionsByUserIds,
  fnMysqlUpsertNotificationSubscription,
  type INotificationSubscriptionRow,
} from '../db/mysqlNotificationSubscriptionAccess';

const STR_FILE = 'notificationSubscriptions.json';

export type { INotificationSubscriptionRow };

const STR_LEGACY_FILE = 'pushSubscriptions.json';

const fnLoadNotificationSubscriptions = (): INotificationSubscriptionRow[] => {
  const arrCurrent = fnLoadJson<INotificationSubscriptionRow>(STR_FILE, []);
  if (arrCurrent.length > 0) return arrCurrent;
  const arrLegacy = fnLoadJson<INotificationSubscriptionRow>(STR_LEGACY_FILE, []);
  if (arrLegacy.length > 0) {
    fnSaveJson(STR_FILE, arrLegacy);
  }
  return arrLegacy;
};

export const arrNotificationSubscriptions: INotificationSubscriptionRow[] = fnLoadNotificationSubscriptions();

const fnInitNextIdFromLoaded = (): number => {
  let nMax = 0;
  for (const row of arrNotificationSubscriptions) {
    if (row.nId > nMax) nMax = row.nId;
  }
  return nMax + 1;
};

let nNextNotificationSubscriptionId = fnInitNextIdFromLoaded();

const fnSaveNotificationSubscriptions = (): void => {
  fnSaveJson(STR_FILE, arrNotificationSubscriptions);
};

export const fnUpsertNotificationSubscription = async (objInput: {
  nUserId: number;
  strEndpoint: string;
  strP256dh: string;
  strAuth: string;
  strUserAgent?: string | null;
}): Promise<INotificationSubscriptionRow> => {
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    return fnMysqlUpsertNotificationSubscription(pool, objInput);
  }
  const nIdx = arrNotificationSubscriptions.findIndex((row) => row.strEndpoint === objInput.strEndpoint);
  const dtNow = new Date().toISOString();
  if (nIdx >= 0) {
    const objExisting = arrNotificationSubscriptions[nIdx];
    objExisting.nUserId = objInput.nUserId;
    objExisting.strP256dh = objInput.strP256dh;
    objExisting.strAuth = objInput.strAuth;
    objExisting.strUserAgent = objInput.strUserAgent ?? null;
    fnSaveNotificationSubscriptions();
    return { ...objExisting };
  }
  const objNew: INotificationSubscriptionRow = {
    nId: nNextNotificationSubscriptionId++,
    nUserId: objInput.nUserId,
    strEndpoint: objInput.strEndpoint,
    strP256dh: objInput.strP256dh,
    strAuth: objInput.strAuth,
    strUserAgent: objInput.strUserAgent ?? null,
    dtCreatedAt: dtNow,
  };
  arrNotificationSubscriptions.push(objNew);
  fnSaveNotificationSubscriptions();
  return { ...objNew };
};

export const fnDeleteNotificationSubscription = async (
  nUserId: number,
  strEndpoint: string,
): Promise<boolean> => {
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    return fnMysqlDeleteNotificationSubscription(pool, nUserId, strEndpoint);
  }
  const nBefore = arrNotificationSubscriptions.length;
  const nIdx = arrNotificationSubscriptions.findIndex(
    (row) => row.nUserId === nUserId && row.strEndpoint === strEndpoint,
  );
  if (nIdx < 0) return false;
  arrNotificationSubscriptions.splice(nIdx, 1);
  fnSaveNotificationSubscriptions();
  return arrNotificationSubscriptions.length < nBefore;
};

export const fnDeleteNotificationSubscriptionByEndpoint = async (strEndpoint: string): Promise<void> => {
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    await fnMysqlDeleteNotificationSubscriptionByEndpoint(pool, strEndpoint);
    return;
  }
  const nIdx = arrNotificationSubscriptions.findIndex((row) => row.strEndpoint === strEndpoint);
  if (nIdx < 0) return;
  arrNotificationSubscriptions.splice(nIdx, 1);
  fnSaveNotificationSubscriptions();
};

export const fnListNotificationSubscriptionsByUserIds = async (
  arrUserIds: number[],
): Promise<INotificationSubscriptionRow[]> => {
  if (arrUserIds.length === 0) return [];
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    return fnMysqlListNotificationSubscriptionsByUserIds(pool, arrUserIds);
  }
  const setIds = new Set(arrUserIds);
  return arrNotificationSubscriptions.filter((row) => setIds.has(row.nUserId));
};

export const fnListAllNotificationSubscriptions = async (): Promise<INotificationSubscriptionRow[]> => {
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    return fnMysqlListAllNotificationSubscriptions(pool);
  }
  return [...arrNotificationSubscriptions];
};
