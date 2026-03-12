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

export const fnGetMergedPermissions = (arrRoleCodes: string[]): string[] => {
  const setPermissions = new Set<string>();
  arrRoleCodes.forEach((strCode) => {
    const objRole = fnFindRoleByCode(strCode);
    if (objRole) fnGetPermissionsByRoleId(objRole.nId).forEach((p) => setPermissions.add(p));
  });
  return Array.from(setPermissions);
};
