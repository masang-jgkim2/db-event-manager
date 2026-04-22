import sql from 'mssql';
import type { IDbConnection, TDbConnectionKind } from '../../types';
import { fnGetSystemPool } from '../../db/systemDb';

const fnKind = (v: unknown): TDbConnectionKind => {
  const s = String(v ?? 'GAME').toUpperCase();
  if (s === 'WEB' || s === 'LOG') return s;
  return 'GAME';
};

const fnRowToConnection = (row: Record<string, unknown>): IDbConnection => {
  const dt = (k: string): string => {
    const v = row[k];
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return new Date().toISOString();
  };
  return {
    nId: Number(row.n_id),
    nProductId: Number(row.n_product_id),
    strProductName: String(row.str_product_name ?? ''),
    strKind: fnKind(row.str_kind),
    strEnv: String(row.str_env) as IDbConnection['strEnv'],
    strDbType: String(row.str_db_type) as IDbConnection['strDbType'],
    strHost: String(row.str_host ?? ''),
    nPort: Number(row.n_port),
    strDatabase: String(row.str_database ?? ''),
    strUser: String(row.str_user ?? ''),
    strPassword: String(row.str_password ?? ''),
    bIsActive: Boolean(row.b_is_active),
    dtCreatedAt: dt('dt_created_at'),
    dtUpdatedAt: dt('dt_updated_at'),
  };
};

/** RDB에 행이 있으면 arr를 교체. 0건이면 JSON 로드값 유지 */
export const fnHydrateDbConnectionsFromRdb = async (arrDbConnections: IDbConnection[]): Promise<void> => {
  const pool = await fnGetSystemPool();
  const result = await pool.request().query(
    `SELECT n_id, n_product_id, str_product_name, str_kind, str_env, str_db_type, str_host, n_port,
            str_database, str_user, str_password, b_is_active, dt_created_at, dt_updated_at
     FROM dbo.db_connections ORDER BY n_id`,
  );
  const arrRows = result.recordset as Record<string, unknown>[];
  if (arrRows.length === 0) {
    console.log('[persistence] db_connections | RDB 0건 — JSON 로드값 유지 (마이그레이션 후 재시작)');
    return;
  }
  const arrMapped = arrRows.map(fnRowToConnection);
  arrDbConnections.length = 0;
  arrDbConnections.push(...arrMapped);
  console.log(`[persistence] db_connections | RDB에서 ${arrMapped.length}건 하이드레이트`);
};

export const fnPersistDbConnectionsToRdb = async (arrDbConnections: IDbConnection[]): Promise<void> => {
  const pool = await fnGetSystemPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).query('DELETE FROM dbo.db_connections');
    await new sql.Request(transaction).query('SET IDENTITY_INSERT dbo.db_connections ON');
    try {
      for (const c of arrDbConnections) {
        const rq = new sql.Request(transaction);
        rq.input('n_id', sql.Int, c.nId);
        rq.input('n_product_id', sql.Int, c.nProductId);
        rq.input('str_product_name', sql.NVarChar(100), c.strProductName);
        rq.input('str_kind', sql.NVarChar(20), c.strKind);
        rq.input('str_env', sql.NVarChar(10), c.strEnv);
        rq.input('str_db_type', sql.NVarChar(20), c.strDbType);
        rq.input('str_host', sql.NVarChar(255), c.strHost);
        rq.input('n_port', sql.Int, c.nPort);
        rq.input('str_database', sql.NVarChar(100), c.strDatabase);
        rq.input('str_user', sql.NVarChar(100), c.strUser);
        rq.input('str_password', sql.NVarChar(255), c.strPassword);
        rq.input('b_is_active', sql.Bit, c.bIsActive ? 1 : 0);
        rq.input('dt_created_at', sql.DateTime2, new Date(c.dtCreatedAt));
        rq.input('dt_updated_at', sql.DateTime2, new Date(c.dtUpdatedAt));
        await rq.query(
          `INSERT INTO dbo.db_connections (
             n_id, n_product_id, str_product_name, str_kind, str_env, str_db_type, str_host, n_port,
             str_database, str_user, str_password, b_is_active, dt_created_at, dt_updated_at
           ) VALUES (
             @n_id, @n_product_id, @str_product_name, @str_kind, @str_env, @str_db_type, @str_host, @n_port,
             @str_database, @str_user, @str_password, @b_is_active, @dt_created_at, @dt_updated_at
           )`,
        );
      }
    } finally {
      await new sql.Request(transaction).query('SET IDENTITY_INSERT dbo.db_connections OFF');
    }
    await transaction.commit();
    console.log(`[persistence] db_connections | RDB 저장 ${arrDbConnections.length}건`);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};
