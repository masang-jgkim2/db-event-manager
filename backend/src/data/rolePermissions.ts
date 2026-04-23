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
  ...['product.view','product.manage','event_template.view','event_template.manage','user.manage','db.manage','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm','instance.approve_qa','instance.execute_qa','instance.verify_qa','instance.approve_live','instance.execute_live','instance.verify_live','system.save_test_seed','activity.view','activity.clear'].map((strPermission) => ({ nRoleId: 1, strPermission })),
  ...['my_dashboard.view','my_dashboard.detail','my_dashboard.confirm','my_dashboard.execute_qa','my_dashboard.execute_live'].map((strPermission) => ({ nRoleId: 2, strPermission })),
  ...['product.view','event_template.view','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm','instance.approve_qa','instance.verify_qa','instance.approve_live','instance.verify_live'].map((strPermission) => ({ nRoleId: 3, strPermission })),
  ...['product.view','event_template.view','instance.create','my_dashboard.view','my_dashboard.detail','my_dashboard.edit','my_dashboard.request_confirm'].map((strPermission) => ({ nRoleId: 4, strPermission })),
];

// DBA(nRoleId 2) 필수 권한 5개 — 예전 파일에 3개만 있으면 보정
const N_DBA_ROLE_ID = 2;
const ARR_DBA_REQUIRED: TPermission[] = ['my_dashboard.view', 'my_dashboard.detail', 'my_dashboard.confirm', 'my_dashboard.execute_qa', 'my_dashboard.execute_live'];

const arrLoaded = fnLoadJson<IRolePermissionRow>(STR_FILE, ARR_SEED);
const arrDbaCurrent = arrLoaded.filter((r) => r.nRoleId === N_DBA_ROLE_ID).map((r) => r.strPermission as TPermission);
const arrMissing = ARR_DBA_REQUIRED.filter((p) => !arrDbaCurrent.includes(p));
if (arrMissing.length > 0) {
  arrMissing.forEach((strPermission) => arrLoaded.push({ nRoleId: N_DBA_ROLE_ID, strPermission }));
  fnSaveJson(STR_FILE, arrLoaded);
}

// 관리자: 활동 로그 조회 권한 보강 (기존 rolePermissions.json에 없을 때)
const N_ADMIN_ROLE_ID = 1;
const bAdminHasActivity = arrLoaded.some(
  (r) => r.nRoleId === N_ADMIN_ROLE_ID && r.strPermission === 'activity.view',
);
if (!bAdminHasActivity) {
  arrLoaded.push({ nRoleId: N_ADMIN_ROLE_ID, strPermission: 'activity.view' });
  fnSaveJson(STR_FILE, arrLoaded);
}

const bAdminHasActivityClear = arrLoaded.some(
  (r) => r.nRoleId === N_ADMIN_ROLE_ID && r.strPermission === 'activity.clear',
);
if (!bAdminHasActivityClear) {
  arrLoaded.push({ nRoleId: N_ADMIN_ROLE_ID, strPermission: 'activity.clear' });
  fnSaveJson(STR_FILE, arrLoaded);
}

export const arrRolePermissions: IRolePermissionRow[] = arrLoaded;

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
