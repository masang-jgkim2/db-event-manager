import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface INotificationSubscriptionRow {
  nId: number;
  nUserId: number;
  strEndpoint: string;
  strP256dh: string;
  strAuth: string;
  strUserAgent: string | null;
  dtCreatedAt: string;
}

const fnRowToSubscription = (row: RowDataPacket): INotificationSubscriptionRow => ({
  nId: Number(row.n_id),
  nUserId: Number(row.n_user_id),
  strEndpoint: String(row.str_endpoint),
  strP256dh: String(row.str_p256dh),
  strAuth: String(row.str_auth),
  strUserAgent: row.str_user_agent != null ? String(row.str_user_agent) : null,
  dtCreatedAt: row.dt_created_at instanceof Date
    ? row.dt_created_at.toISOString()
    : String(row.dt_created_at),
});

export const fnMysqlUpsertNotificationSubscription = async (
  pool: Pool,
  objInput: {
    nUserId: number;
    strEndpoint: string;
    strP256dh: string;
    strAuth: string;
    strUserAgent?: string | null;
  },
): Promise<INotificationSubscriptionRow> => {
  await pool.query(
    `INSERT INTO notification_subscription (n_user_id, str_endpoint, str_p256dh, str_auth, str_user_agent)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       n_user_id = VALUES(n_user_id),
       str_p256dh = VALUES(str_p256dh),
       str_auth = VALUES(str_auth),
       str_user_agent = VALUES(str_user_agent)`,
    [
      objInput.nUserId,
      objInput.strEndpoint,
      objInput.strP256dh,
      objInput.strAuth,
      objInput.strUserAgent ?? null,
    ],
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, n_user_id, str_endpoint, str_p256dh, str_auth, str_user_agent, dt_created_at
     FROM notification_subscription WHERE str_endpoint = ? LIMIT 1`,
    [objInput.strEndpoint],
  );
  return fnRowToSubscription(rows[0]);
};

export const fnMysqlDeleteNotificationSubscription = async (
  pool: Pool,
  nUserId: number,
  strEndpoint: string,
): Promise<boolean> => {
  const [res] = await pool.query(
    'DELETE FROM notification_subscription WHERE n_user_id = ? AND str_endpoint = ?',
    [nUserId, strEndpoint],
  );
  const obj = res as { affectedRows?: number };
  return (obj.affectedRows ?? 0) > 0;
};

export const fnMysqlDeleteNotificationSubscriptionByEndpoint = async (
  pool: Pool,
  strEndpoint: string,
): Promise<void> => {
  await pool.query('DELETE FROM notification_subscription WHERE str_endpoint = ?', [strEndpoint]);
};

export const fnMysqlListNotificationSubscriptionsByUserIds = async (
  pool: Pool,
  arrUserIds: number[],
): Promise<INotificationSubscriptionRow[]> => {
  if (arrUserIds.length === 0) return [];
  const strPlaceholders = arrUserIds.map(() => '?').join(', ');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, n_user_id, str_endpoint, str_p256dh, str_auth, str_user_agent, dt_created_at
     FROM notification_subscription WHERE n_user_id IN (${strPlaceholders})`,
    arrUserIds,
  );
  return rows.map(fnRowToSubscription);
};

export const fnMysqlListAllNotificationSubscriptions = async (
  pool: Pool,
): Promise<INotificationSubscriptionRow[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n_id, n_user_id, str_endpoint, str_p256dh, str_auth, str_user_agent, dt_created_at
     FROM notification_subscription`,
  );
  return rows.map(fnRowToSubscription);
};
