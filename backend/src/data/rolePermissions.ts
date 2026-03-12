// 정규화: 역할별 권한 (roles.arr_permissions 분리)
import type { TPermission } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';

export interface IRolePermissionRow {
  nRoleId: number;
  strPermission: string;
}

const STR_FILE = 'rolePermissions.json';

// 시드: 파일 없거나 비어 있을 때 역할별 권한 초기 데이터
const ARR_SEED: IRolePermissionRow[] = [
  ...['product.view','product.manage','event_template.view','event_template.manage','user.manage','db.manage','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm','instance.approve_qa','instance.execute_qa','instance.verify_qa','instance.approve_live','instance.execute_live','instance.verify_live'].map((strPermission) => ({ nRoleId: 1, strPermission })),
  ...['instance.execute_qa','instance.execute_live','my_dashboard.view','my_dashboard.detail'].map((strPermission) => ({ nRoleId: 2, strPermission })),
  ...['product.view','event_template.view','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm','instance.approve_qa','instance.verify_qa','instance.approve_live','instance.verify_live'].map((strPermission) => ({ nRoleId: 3, strPermission })),
  ...['product.view','event_template.view','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm'].map((strPermission) => ({ nRoleId: 4, strPermission })),
];

export const arrRolePermissions: IRolePermissionRow[] = fnLoadJson<IRolePermissionRow>(STR_FILE, ARR_SEED);

export const fnSaveRolePermissions = () => fnSaveJson(STR_FILE, arrRolePermissions);

/** 해당 역할의 권한 코드 배열 반환 */
export const fnGetPermissionsByRoleId = (nRoleId: number): TPermission[] =>
  arrRolePermissions
    .filter((r) => r.nRoleId === nRoleId)
    .map((r) => r.strPermission as TPermission);

/** 해당 역할의 권한을 교체 (기존 삭제 후 새 목록 INSERT) */
export const fnSetPermissionsForRole = (nRoleId: number, arrPermissions: TPermission[]): void => {
  for (let i = arrRolePermissions.length - 1; i >= 0; i--) {
    if (arrRolePermissions[i].nRoleId === nRoleId) arrRolePermissions.splice(i, 1);
  }
  arrPermissions.forEach((strPermission) => {
    arrRolePermissions.push({ nRoleId, strPermission });
  });
};

/** 해당 역할의 권한 행 전부 삭제 (역할 삭제 시) */
export const fnDeletePermissionsForRole = (nRoleId: number): void => {
  for (let i = arrRolePermissions.length - 1; i >= 0; i--) {
    if (arrRolePermissions[i].nRoleId === nRoleId) arrRolePermissions.splice(i, 1);
  }
};
