import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import {
  fnMysqlInsertUserNotification,
  fnMysqlListUserNotifications,
  fnMysqlMarkAllUserNotificationsRead,
  fnMysqlMarkUserNotificationRead,
  fnMysqlTrimUserNotifications,
  type IUserNotificationInsert,
  type IUserNotificationRow,
} from '../db/mysqlUserNotificationAccess';

export const N_MAX_USER_NOTIFICATIONS = 100;

export type { IUserNotificationInsert, IUserNotificationRow };

export const fnIsInAppNotificationsPersisted = (): boolean => fnIsMysqlStore();

export const fnListUserNotifications = async (nUserId: number): Promise<IUserNotificationRow[]> => {
  if (!fnIsMysqlStore() || nUserId <= 0) return [];
  const pool = fnGetMysqlAppPool();
  return fnMysqlListUserNotifications(pool, nUserId, N_MAX_USER_NOTIFICATIONS);
};

export const fnAppendUserNotification = async (
  nUserId: number,
  objInput: IUserNotificationInsert,
): Promise<IUserNotificationRow | null> => {
  if (!fnIsMysqlStore() || nUserId <= 0) return null;
  const pool = fnGetMysqlAppPool();
  const objSaved = await fnMysqlInsertUserNotification(pool, nUserId, objInput);
  await fnMysqlTrimUserNotifications(pool, nUserId, N_MAX_USER_NOTIFICATIONS);
  return objSaved;
};

export const fnMarkUserNotificationRead = async (
  nUserId: number,
  strId: string,
): Promise<boolean> => {
  if (!fnIsMysqlStore() || nUserId <= 0) return false;
  const pool = fnGetMysqlAppPool();
  return fnMysqlMarkUserNotificationRead(pool, nUserId, strId);
};

export const fnMarkAllUserNotificationsRead = async (nUserId: number): Promise<void> => {
  if (!fnIsMysqlStore() || nUserId <= 0) return;
  const pool = fnGetMysqlAppPool();
  await fnMysqlMarkAllUserNotificationsRead(pool, nUserId);
};
