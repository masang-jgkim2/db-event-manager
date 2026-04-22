import sql from 'mssql';
import { fnGetSystemPool } from '../../db/systemDb';
import type { IRoleRow } from '../../data/roles';
import type { IRolePermissionRow } from '../../data/rolePermissions';
import type { IUserRow } from '../../data/users';
import type { IUserRoleRow } from '../../data/userRoles';

/** RDB에 앱이 쌓아 둔 인증 데이터가 있으면 하이드레이트(role_permissions / user_roles / users) */
const fnGateAuthHydrate = async (pool: sql.ConnectionPool): Promise<boolean> => {
  const rp = await pool.request().query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM dbo.role_permissions`,
  );
  const ur = await pool.request().query<{ c: number }>(`SELECT COUNT(*) AS c FROM dbo.user_roles`);
  const u = await pool.request().query<{ c: number }>(`SELECT COUNT(*) AS c FROM dbo.users`);
  const nRp = Number(rp.recordset[0]?.c) || 0;
  const nUr = Number(ur.recordset[0]?.c) || 0;
  const nU = Number(u.recordset[0]?.c) || 0;
  return nRp > 0 || nUr > 0 || nU > 0;
};

const fnMapRole = (row: Record<string, unknown>): IRoleRow => ({
  nId: Number(row.n_id),
  strCode: String(row.str_code ?? ''),
  strDisplayName: String(row.str_display_name ?? ''),
  strDescription: String(row.str_description ?? ''),
  bIsSystem: Boolean(row.b_is_system),
  dtCreatedAt:
    row.dt_created_at instanceof Date
      ? row.dt_created_at.toISOString()
      : String(row.dt_created_at ?? ''),
  dtUpdatedAt:
    row.dt_updated_at instanceof Date
      ? row.dt_updated_at.toISOString()
      : String(row.dt_updated_at ?? ''),
});

const fnMapUser = (row: Record<string, unknown>): IUserRow => ({
  nId: Number(row.n_id),
  strUserId: String(row.str_user_id ?? ''),
  strPassword: String(row.str_password ?? ''),
  strDisplayName: String(row.str_display_name ?? ''),
  dtCreatedAt:
    row.dt_created_at instanceof Date
      ? row.dt_created_at.toISOString()
      : String(row.dt_created_at ?? ''),
});

/** 게이트 통과 시 roles·role_permissions·users·user_roles 전부 RDB 스냅샷으로 메모리 교체 */
export const fnHydrateAuthDomainFromRdb = async (
  arrRoles: IRoleRow[],
  arrRolePermissions: IRolePermissionRow[],
  arrUsers: IUserRow[],
  arrUserRoles: IUserRoleRow[],
): Promise<void> => {
  const pool = await fnGetSystemPool();
  const bGate = await fnGateAuthHydrate(pool);
  if (!bGate) {
    console.log('[persistence] roles/users | RDB에 users·role_permissions·user_roles 유입 없음 — JSON 유지');
    return;
  }

  const rRoles = await pool.request().query(
    `SELECT n_id, str_code, str_display_name, str_description, b_is_system, dt_created_at, dt_updated_at
     FROM dbo.roles ORDER BY n_id`,
  );
  const rPerms = await pool.request().query(
    `SELECT n_role_id, str_permission FROM dbo.role_permissions ORDER BY n_role_id, str_permission`,
  );
  const rUsers = await pool.request().query(
    `SELECT n_id, str_user_id, str_password, str_display_name, dt_created_at FROM dbo.users ORDER BY n_id`,
  );
  const rUr = await pool.request().query(
    `SELECT n_user_id, n_role_id FROM dbo.user_roles ORDER BY n_user_id, n_role_id`,
  );

  const arrR = (rRoles.recordset as Record<string, unknown>[]).map(fnMapRole);
  const arrP = (rPerms.recordset as { n_role_id: number; str_permission: string }[]).map((x) => ({
    nRoleId: x.n_role_id,
    strPermission: x.str_permission,
  }));
  const arrU = (rUsers.recordset as Record<string, unknown>[]).map(fnMapUser);
  const arrUR = (rUr.recordset as { n_user_id: number; n_role_id: number }[]).map((x) => ({
    nUserId: x.n_user_id,
    nRoleId: x.n_role_id,
  }));

  arrRoles.length = 0;
  arrRoles.push(...arrR);
  arrRolePermissions.length = 0;
  arrRolePermissions.push(...arrP);
  arrUsers.length = 0;
  arrUsers.push(...arrU);
  arrUserRoles.length = 0;
  arrUserRoles.push(...arrUR);

  console.log(
    `[persistence] roles/users | RDB 하이드레이트 roles=${arrR.length} perms=${arrP.length} users=${arrU.length} user_roles=${arrUR.length}`,
  );
};

/** 역할·권한·사용자·user_roles 전체 스냅샷 저장 (FK 순서 준수) */
export const fnPersistAuthDomainToRdb = async (obj: {
  arrRoles: IRoleRow[];
  arrRolePermissions: IRolePermissionRow[];
  arrUsers: IUserRow[];
  arrUserRoles: IUserRoleRow[];
}): Promise<void> => {
  const pool = await fnGetSystemPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    await new sql.Request(t).query('DELETE FROM dbo.user_roles');
    await new sql.Request(t).query('DELETE FROM dbo.role_permissions');
    await new sql.Request(t).query('DELETE FROM dbo.users');
    await new sql.Request(t).query('DELETE FROM dbo.roles');

    await new sql.Request(t).query('SET IDENTITY_INSERT dbo.roles ON');
    try {
      for (const r of obj.arrRoles) {
        const rq = new sql.Request(t);
        rq.input('n_id', sql.Int, r.nId);
        rq.input('str_code', sql.NVarChar(50), r.strCode);
        rq.input('str_display_name', sql.NVarChar(100), r.strDisplayName);
        rq.input('str_description', sql.NVarChar(sql.MAX), r.strDescription);
        rq.input('arr_permissions', sql.NVarChar(sql.MAX), '[]');
        rq.input('b_is_system', sql.Bit, r.bIsSystem ? 1 : 0);
        rq.input('dt_created_at', sql.DateTime2, new Date(r.dtCreatedAt));
        rq.input('dt_updated_at', sql.DateTime2, new Date(r.dtUpdatedAt));
        await rq.query(
          `INSERT INTO dbo.roles (n_id, str_code, str_display_name, str_description, arr_permissions, b_is_system, dt_created_at, dt_updated_at)
           VALUES (@n_id, @str_code, @str_display_name, @str_description, @arr_permissions, @b_is_system, @dt_created_at, @dt_updated_at)`,
        );
      }
    } finally {
      await new sql.Request(t).query('SET IDENTITY_INSERT dbo.roles OFF');
    }

    for (const p of obj.arrRolePermissions) {
      const rq = new sql.Request(t);
      rq.input('n_role_id', sql.Int, p.nRoleId);
      rq.input('str_permission', sql.NVarChar(120), p.strPermission);
      await rq.query(
        `INSERT INTO dbo.role_permissions (n_role_id, str_permission) VALUES (@n_role_id, @str_permission)`,
      );
    }

    await new sql.Request(t).query('SET IDENTITY_INSERT dbo.users ON');
    try {
      for (const u of obj.arrUsers) {
        const rq = new sql.Request(t);
        rq.input('n_id', sql.Int, u.nId);
        rq.input('str_user_id', sql.NVarChar(50), u.strUserId);
        rq.input('str_password', sql.NVarChar(255), u.strPassword);
        rq.input('str_display_name', sql.NVarChar(100), u.strDisplayName);
        rq.input('arr_roles', sql.NVarChar(sql.MAX), '[]');
        rq.input('dt_created_at', sql.DateTime2, new Date(u.dtCreatedAt));
        await rq.query(
          `INSERT INTO dbo.users (n_id, str_user_id, str_password, str_display_name, arr_roles, dt_created_at)
           VALUES (@n_id, @str_user_id, @str_password, @str_display_name, @arr_roles, @dt_created_at)`,
        );
      }
    } finally {
      await new sql.Request(t).query('SET IDENTITY_INSERT dbo.users OFF');
    }

    for (const ur of obj.arrUserRoles) {
      const rq = new sql.Request(t);
      rq.input('n_user_id', sql.Int, ur.nUserId);
      rq.input('n_role_id', sql.Int, ur.nRoleId);
      await rq.query(
        `INSERT INTO dbo.user_roles (n_user_id, n_role_id) VALUES (@n_user_id, @n_role_id)`,
      );
    }

    await t.commit();
    console.log('[persistence] roles/users | RDB 저장 완료');
  } catch (err) {
    await t.rollback();
    throw err;
  }
};
