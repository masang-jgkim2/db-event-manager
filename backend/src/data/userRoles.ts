// 정규화: 사용자별 역할 (users.arr_roles 분리)
import { fnLoadJson, fnSaveJson } from './jsonStore';

export interface IUserRoleRow {
  nUserId: number;
  nRoleId: number;
}

const STR_FILE = 'userRoles.json';

// 시드: admin=1→role1, gm01=2→role3, dba01=3→role2 (역할 코드는 roles.str_code로 매핑)
const ARR_SEED: IUserRoleRow[] = [
  { nUserId: 1, nRoleId: 1 }, // admin → admin
  { nUserId: 2, nRoleId: 3 }, // gm01 → game_manager
  { nUserId: 3, nRoleId: 2 }, // dba01 → dba
];

export const arrUserRoles: IUserRoleRow[] = fnLoadJson<IUserRoleRow>(STR_FILE, ARR_SEED);

// 파일이 존재하지만 비어 있었을 경우 시드 복구 (권한 뷰가 전부 동일하게 나오는 현상 방지)
if (arrUserRoles.length === 0 && ARR_SEED.length > 0) {
  ARR_SEED.forEach((r) => arrUserRoles.push({ nUserId: r.nUserId, nRoleId: r.nRoleId }));
  fnSaveJson(STR_FILE, arrUserRoles);
}

export const fnSaveUserRoles = () => fnSaveJson(STR_FILE, arrUserRoles);

/** 해당 사용자의 역할 ID 목록 */
export const fnGetRoleIdsByUserId = (nUserId: number): number[] =>
  arrUserRoles.filter((u) => u.nUserId === nUserId).map((u) => u.nRoleId);

/** 해당 사용자의 역할을 교체 (기존 삭제 후 새 목록 INSERT) */
export const fnSetRolesForUser = (nUserId: number, arrRoleIds: number[]): void => {
  for (let i = arrUserRoles.length - 1; i >= 0; i--) {
    if (arrUserRoles[i].nUserId === nUserId) arrUserRoles.splice(i, 1);
  }
  arrRoleIds.forEach((nRoleId) => {
    arrUserRoles.push({ nUserId, nRoleId });
  });
};

/** 사용자 삭제 시 해당 사용자의 user_roles 행 제거 후 저장 */
export const fnRemoveUserRolesAndSave = (nUserId: number): void => {
  for (let i = arrUserRoles.length - 1; i >= 0; i--) {
    if (arrUserRoles[i].nUserId === nUserId) arrUserRoles.splice(i, 1);
  }
  fnSaveUserRoles();
};
