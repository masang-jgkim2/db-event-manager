// 사용자 — 정규화: 역할은 userRoles.ts에서 조회/저장
import bcrypt from 'bcryptjs';
import { IUser } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';
import { arrRoles, fnGetRoleIdsByRoleCodes } from './roles';
import { fnGetRoleIdsByUserId, fnSaveUserRoles, fnSetRolesForUser } from './userRoles';

/** 저장용 사용자 행 (arrRoles 없음) */
interface IUserRow {
  nId: number;
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  dtCreatedAt: string;
}

const STR_FILE = 'users.json';

const ARR_SEED: IUserRow[] = [
  { nId: 1, strUserId: 'admin', strPassword: '__PENDING__', strDisplayName: '관리자', dtCreatedAt: new Date().toISOString() },
  { nId: 2, strUserId: 'gm01', strPassword: '__PENDING__', strDisplayName: 'GM_홍길동', dtCreatedAt: new Date().toISOString() },
  { nId: 3, strUserId: 'dba01', strPassword: '__PENDING__', strDisplayName: 'DBA_김철수', dtCreatedAt: new Date().toISOString() },
  { nId: 4, strUserId: 'planner01', strPassword: '__PENDING__', strDisplayName: '기획자_이영희', dtCreatedAt: new Date().toISOString() },
];

export const arrUsers: IUserRow[] = fnLoadJson<IUserRow>(STR_FILE, ARR_SEED);

export const fnSaveUsers = () => fnSaveJson(STR_FILE, arrUsers);

export const fnGetNextId = (): number =>
  arrUsers.length > 0 ? Math.max(...arrUsers.map((u) => u.nId)) + 1 : 1;

/** nRoleId → strCode (roles 조회) */
const fnGetRoleCodesByRoleIds = (arrRoleIds: number[]): string[] =>
  arrRoleIds
    .map((nRoleId) => arrRoles.find((r) => r.nId === nRoleId)?.strCode)
    .filter((s): s is string => Boolean(s));

/** API용 IUser[] (arrRoles는 user_roles + roles에서 조립) */
export const fnGetUsersWithRoles = (): IUser[] =>
  arrUsers.map((u) => ({
    ...u,
    dtCreatedAt: new Date(u.dtCreatedAt),
    arrRoles: fnGetRoleCodesByRoleIds(fnGetRoleIdsByUserId(u.nId)),
  }));

/** strUserId로 조립된 사용자 1명 반환 (로그인/검증용) */
/** 파일에서 사용자 목록 다시 로드 (서버 재시작 없이 수동 추가 사용자 반영) */
export const fnReloadUsersFromFile = (): void => {
  const arrLoaded = fnLoadJson<IUserRow>(STR_FILE, ARR_SEED);
  arrUsers.length = 0;
  arrUsers.push(...arrLoaded);
};

/** strUserId로 조립된 사용자 1명 반환 (로그인/검증용) */
export const fnFindUserByStrUserId = (strUserId: string): IUser | undefined => {
  let row = arrUsers.find((u) => u.strUserId === strUserId);
  if (!row) {
    fnReloadUsersFromFile();
    row = arrUsers.find((u) => u.strUserId === strUserId);
  }
  if (!row) return undefined;
  return {
    ...row,
    dtCreatedAt: new Date(row.dtCreatedAt),
    arrRoles: fnGetRoleCodesByRoleIds(fnGetRoleIdsByUserId(row.nId)),
  };
};

export const fnFindUserRowById = (nId: number): IUserRow | undefined =>
  arrUsers.find((u) => u.nId === nId);

/** 사용자 역할 수정 후 저장 */
export const fnSaveUserAndRoles = (nUserId: number, arrRoleIds: number[]) => {
  fnSetRolesForUser(nUserId, arrRoleIds);
  fnSaveUserRoles();
  fnSaveUsers();
};

// 서버 시작 시 비밀번호 해시 초기화 (플레이스홀더인 경우에만)
export const fnInitUsers = async () => {
  let bChanged = false;
  const OBJ_DEFAULT_PASSWORDS: Record<string, string> = {
    admin: 'admin123',
    gm01:  'gm123',
    dba01: 'dba123',
    planner01: 'planner123',
  };

  for (const objUser of arrUsers) {
    if (objUser.strPassword === '__PENDING__') {
      const strDefault = OBJ_DEFAULT_PASSWORDS[objUser.strUserId] || 'changeme';
      objUser.strPassword = await bcrypt.hash(strDefault, 10);
      bChanged = true;
    }
  }

  if (bChanged) fnSaveJson(STR_FILE, arrUsers);
};

/** 특정 사용자 비밀번호 초기화 (설정용 API에서 사용, 파일·메모리 모두 반영) */
export const fnResetPasswordByUserId = async (strUserId: string, strNewPassword: string): Promise<boolean> => {
  fnReloadUsersFromFile();
  const row = arrUsers.find((u) => u.strUserId === strUserId);
  if (!row) return false;
  row.strPassword = await bcrypt.hash(strNewPassword, 10);
  fnSaveUsers();
  return true;
};
