// 역할 — 정규화: 권한은 rolePermissions.ts에서 조회/저장
import { IRole, TPermission } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';
import {
  fnDeletePermissionsForRole,
  fnGetPermissionsByRoleId,
  fnSaveRolePermissions,
  fnSetPermissionsForRole,
} from './rolePermissions';

/** 저장용 역할 행 (arrPermissions 없음) */
interface IRoleRow {
  nId: number;
  strCode: string;
  strDisplayName: string;
  strDescription: string;
  bIsSystem: boolean;
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

const STR_FILE = 'roles.json';

const ARR_SEED_ROWS: IRoleRow[] = [
  { nId: 1, strCode: 'admin', strDisplayName: '관리자', strDescription: '전체 시스템 관리 권한', bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString() },
  { nId: 2, strCode: 'dba', strDisplayName: 'DBA', strDescription: 'DB 쿼리 실행 전담', bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString() },
  { nId: 3, strCode: 'game_manager', strDisplayName: 'GM', strDescription: '게임 운영 관리자', bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString() },
  { nId: 4, strCode: 'game_designer', strDisplayName: '기획자', strDescription: '이벤트 기획 및 생성', bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString() },
];

export const arrRoles: IRoleRow[] = fnLoadJson<IRoleRow>(STR_FILE, ARR_SEED_ROWS);

export const fnSaveRoles = () => fnSaveJson(STR_FILE, arrRoles);

export const fnGetNextRoleId = (): number =>
  arrRoles.length > 0 ? Math.max(...arrRoles.map((r) => r.nId)) + 1 : 1;

export const fnFindRoleByCode = (strCode: string): IRoleRow | undefined =>
  arrRoles.find((r) => r.strCode === strCode);

export const fnFindRoleRowById = (nId: number): IRoleRow | undefined =>
  arrRoles.find((r) => r.nId === nId);

/** 역할 코드 배열 → 역할 ID 배열 (user_roles 저장 시 사용) */
export const fnGetRoleIdsByRoleCodes = (arrRoleCodes: string[]): number[] =>
  arrRoleCodes
    .map((strCode) => fnFindRoleByCode(strCode)?.nId)
    .filter((n): n is number => n != null);

/** API용 IRole[] (권한은 role_permissions에서 조립) — 목록/응답용 */
export const fnGetRolesWithPermissions = (): IRole[] =>
  arrRoles.map((r) => ({
    ...r,
    arrPermissions: fnGetPermissionsByRoleId(r.nId),
  }));

/** 권한 수정 시 호출 (role_permissions 갱신 + 저장) */
export const fnSaveRoleAndPermissions = (nRoleId: number, arrPermissions: TPermission[]) => {
  fnSetPermissionsForRole(nRoleId, arrPermissions);
  fnSaveRolePermissions();
  fnSaveRoles();
};

/** 역할 삭제 시 해당 역할 권한 행 제거 후 저장 */
export const fnRemoveRolePermissionsAndSave = (nRoleId: number) => {
  fnDeletePermissionsForRole(nRoleId);
  fnSaveRolePermissions();
};

/** 역할별 권한 합집합 (저장된 코드만) */
export const fnGetMergedPermissions = (arrRoleCodes: string[]): string[] => {
  const setPermissions = new Set<string>();
  arrRoleCodes.forEach((strCode) => {
    const objRole = fnFindRoleByCode(strCode);
    if (objRole) fnGetPermissionsByRoleId(objRole.nId).forEach((p) => setPermissions.add(p));
  });
  return Array.from(setPermissions);
};

/** 레거시 권한 → 세분화 권한 확장 (클라이언트 응답용). admin 역할 시 대시보드/사용자/역할/DB 접속 세분화 추가 */
const OBJ_EXPAND: Record<string, string[]> = {
  'product.manage': ['product.view', 'product.create', 'product.edit', 'product.delete'],
  'event_template.manage': ['event_template.view', 'event_template.create', 'event_template.edit', 'event_template.delete'],
  'user.manage': ['user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password'],
  'db.manage': ['db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test'],
  // instance.create는 이벤트 수정/컨펌 요청 권한을 자동 부여하지 않음 (역할에서 별도 체크한 권한만 적용)
  'instance.create': ['instance.view'],
  'instance.approve_qa': ['my_dashboard.request_qa', 'my_dashboard.request_qa_rereq'],
  // 쿼리 수정(query_edit)은 별도 권한 — execute_qa만으로는 부여하지 않음
  'instance.execute_qa': ['my_dashboard.execute_qa', 'my_dashboard.confirm'],
  'instance.verify_qa': ['my_dashboard.verify_qa'],
  'instance.approve_live': ['my_dashboard.request_live', 'my_dashboard.request_live_rereq'],
  'instance.execute_live': ['my_dashboard.execute_live'],
  'instance.verify_live': ['my_dashboard.verify_live'],
};

export const fnExpandPermissions = (arrRaw: string[], arrRoleCodes: string[]): string[] => {
  const setOut = new Set<string>(arrRaw);
  arrRaw.forEach((p) => {
    const arrExp = OBJ_EXPAND[p];
    if (arrExp) arrExp.forEach((e) => setOut.add(e));
  });
  if (arrRoleCodes.includes('admin')) {
    ['dashboard.view', 'my_dashboard.view', 'my_dashboard.edit_any', 'user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password', 'role.view', 'role.create', 'role.edit', 'role.delete', 'role.edit_permissions', 'db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test', 'system.save_test_seed'].forEach((p) => setOut.add(p));
  }
  return Array.from(setOut);
};
