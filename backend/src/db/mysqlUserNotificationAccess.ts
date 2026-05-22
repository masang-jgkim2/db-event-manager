import type { Pool, RowDataPacket } from 'mysql2/promise';

export type TUserNotificationLevel = 'success' | 'error' | 'warning' | 'info';

export interface IUserNotificationRow {
  strId: string;
  dtAt: string;
  strLevel: TUserNotificationLevel;
  strTitle: string;
  strBody?: string | null;
  strRoute?: string | null;
  objQuery?: Record<string, string | number | boolean> | null;
  bRead: boolean;
  strSource?: string | null;
}

export interface IUserNotificationInsert {
  strLevel: TUserNotificationLevel;
  strTitle: string;
  strBody?: string | null;
  strRoute?: string | null;
  objQuery?: Record<string, string | number | boolean> | null;
  strSource?: string | null;
}

const fnRowToNotification = (row: RowDataPacket): IUserNotificationRow => {
  let objQuery: Record<string, string | number | boolean> | null = null;
  if (row.str_query_json != null && String(row.str_query_json).trim() !== '') {
    try {
      objQuery = JSON.parse(String(row.str_query_json)) as Record<string, string | number | boolean>;
    } catch {
      objQuery = null;
    }
  }
  return {
    strId: String(row.str_id),
    dtAt: row.dt_at instanceof Date ? row.dt_at.toISOString() : String(row.dt_at),
    strLevel: String(row.str_level) as TUserNotificationLevel,
    strTitle: String(row.str_title),
    strBody: row.str_body != null ? String(row.str_body) : null,
    strRoute: row.str_route != null ? String(row.str_route) : null,
    objQuery,
    bRead: Boolean(row.b_read),
    strSource: row.str_source != null ? String(row.str_source) : null,
  };
};

export const fnMysqlListUserNotifications = async (
  pool: Pool,
  nUserId: number,
  nLimit: number,
): Promise<IUserNotificationRow[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT str_id, dt_at, str_level, str_title, str_body, str_route, str_query_json, b_read, str_source
     FROM user_notification
     WHERE n_user_id = ?
     ORDER BY dt_at DESC, n_id DESC
     LIMIT ?`,
    [nUserId, nLimit],
  );
  return rows.map(fnRowToNotification);
};

export const fnMysqlInsertUserNotification = async (
  pool: Pool,
  nUserId: number,
  objInput: IUserNotificationInsert,
): Promise<IUserNotificationRow> => {
  const strId = crypto.randomUUID();
  const dtAt = new Date();
  const strQueryJson = objInput.objQuery ? JSON.stringify(objInput.objQuery) : null;
  await pool.query(
    `INSERT INTO user_notification
      (n_user_id, str_id, dt_at, str_level, str_title, str_body, str_route, str_query_json, b_read, str_source)
     VALUES (?,?,?,?,?,?,?,?,0,?)`,
    [
      nUserId,
      strId,
      dtAt,
      objInput.strLevel,
      objInput.strTitle,
      objInput.strBody ?? null,
      objInput.strRoute ?? null,
      strQueryJson,
      objInput.strSource ?? null,
    ],
  );
  return {
    strId,
    dtAt: dtAt.toISOString(),
    strLevel: objInput.strLevel,
    strTitle: objInput.strTitle,
    strBody: objInput.strBody ?? null,
    strRoute: objInput.strRoute ?? null,
    objQuery: objInput.objQuery ?? null,
    bRead: false,
    strSource: objInput.strSource ?? null,
  };
};

export const fnMysqlTrimUserNotifications = async (
  pool: Pool,
  nUserId: number,
  nKeep: number,
): Promise<void> => {
  await pool.query(
    `DELETE FROM user_notification
     WHERE n_user_id = ?
       AND n_id NOT IN (
         SELECT n_id FROM (
           SELECT n_id FROM user_notification
           WHERE n_user_id = ?
           ORDER BY dt_at DESC, n_id DESC
           LIMIT ?
         ) AS kept
       )`,
    [nUserId, nUserId, nKeep],
  );
};

export const fnMysqlMarkUserNotificationRead = async (
  pool: Pool,
  nUserId: number,
  strId: string,
): Promise<boolean> => {
  const [res] = await pool.query(
    'UPDATE user_notification SET b_read = 1 WHERE n_user_id = ? AND str_id = ?',
    [nUserId, strId],
  );
  const obj = res as { affectedRows?: number };
  return (obj.affectedRows ?? 0) > 0;
};

export const fnMysqlMarkAllUserNotificationsRead = async (
  pool: Pool,
  nUserId: number,
): Promise<void> => {
  await pool.query(
    'UPDATE user_notification SET b_read = 1 WHERE n_user_id = ? AND b_read = 0',
    [nUserId],
  );
};
