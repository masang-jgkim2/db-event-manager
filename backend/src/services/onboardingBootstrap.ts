import type { RowDataPacket } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { STR_ROLE_GUEST } from '../types/userStatus';

const N_GUEST_ROLE_ID = 6;

const fnToMysqlDatetime6 = (v: string | Date): string => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '1970-01-01 00:00:00.000000';
  const p = (n: number, L: number) => String(n).padStart(L, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1, 2)}-${p(d.getDate(), 2)} ${p(d.getHours(), 2)}:${p(d.getMinutes(), 2)}:${p(d.getSeconds(), 2)}.${p(d.getMilliseconds(), 3)}000`;
};

/** 가입·승인에 필요한 guest 역할·admin 승인 권한 보장 (MySQL·JSON) */
export const fnEnsureOnboardingPrerequisites = async (): Promise<void> => {
  const { arrRoles, fnFindRoleByCode, fnSaveRoles } = await import('../data/roles');
  const {
    fnSetPermissionsForRole,
    fnGetPermissionsByRoleId,
    fnSaveRolePermissions,
  } = await import('../data/rolePermissions');

  const dtNow = new Date().toISOString();
  const strDtMysql = fnToMysqlDatetime6(dtNow);
  let bChanged = false;

  if (!fnFindRoleByCode(STR_ROLE_GUEST)) {
    arrRoles.push({
      nId: N_GUEST_ROLE_ID,
      strCode: STR_ROLE_GUEST,
      strDisplayName: '승인 대기(GUEST)',
      strDescription: '가입 시 부여(로그인은 승인 후)',
      bIsSystem: true,
      dtCreatedAt: dtNow,
      dtUpdatedAt: dtNow,
    });
    fnSetPermissionsForRole(N_GUEST_ROLE_ID, ['my_dashboard.view']);
    fnSaveRolePermissions();
    fnSaveRoles();
    bChanged = true;
    console.log('[온보딩] guest 역할 메모리 생성');
  }

  const objAdmin = fnFindRoleByCode('admin');
  if (objAdmin) {
    const arrPerms = fnGetPermissionsByRoleId(objAdmin.nId);
    if (!arrPerms.includes('user.approve')) {
      fnSetPermissionsForRole(objAdmin.nId, [...arrPerms, 'user.approve']);
      fnSaveRolePermissions();
      bChanged = true;
      console.log('[온보딩] admin | user.approve 권한 추가');
    }
  }

  if (!fnIsMysqlStore()) return;

  const pool = fnGetMysqlAppPool();
  let [arrGuestRows] = await pool.query<RowDataPacket[]>(
    'SELECT n_id FROM roles WHERE str_code = ?',
    [STR_ROLE_GUEST],
  );
  let nGuestRoleId = N_GUEST_ROLE_ID;
  if (arrGuestRows.length === 0) {
    await pool.execute(
      `INSERT INTO roles (n_id, str_code, str_display_name, str_description, b_is_system, dt_created_at, dt_updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [
        N_GUEST_ROLE_ID,
        STR_ROLE_GUEST,
        '승인 대기(GUEST)',
        '가입 시 부여(로그인은 승인 후)',
        1,
        strDtMysql,
        strDtMysql,
      ],
    );
    bChanged = true;
    console.log('[온보딩] guest 역할 MySQL INSERT');
  } else {
    nGuestRoleId = Number(arrGuestRows[0]?.n_id) || N_GUEST_ROLE_ID;
  }
  const [arrPermRows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM role_permissions WHERE n_role_id = ? AND str_permission = ?',
    [nGuestRoleId, 'my_dashboard.view'],
  );
  if (arrPermRows.length === 0) {
    await pool.execute(
      'INSERT INTO role_permissions (n_role_id, str_permission) VALUES (?,?)',
      [nGuestRoleId, 'my_dashboard.view'],
    );
    bChanged = true;
  }

  if (objAdmin) {
    const [arrAppr] = await pool.query<RowDataPacket[]>(
      'SELECT 1 FROM role_permissions WHERE n_role_id = ? AND str_permission = ?',
      [objAdmin.nId, 'user.approve'],
    );
    if (arrAppr.length === 0) {
      await pool.execute(
        'INSERT INTO role_permissions (n_role_id, str_permission) VALUES (?,?)',
        [objAdmin.nId, 'user.approve'],
      );
      bChanged = true;
    }
  }

  if (bChanged) {
    console.log('[온보딩] MySQL roles·role_permissions 보정 완료');
  }
};
