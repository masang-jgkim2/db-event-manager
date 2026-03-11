import bcrypt from 'bcryptjs';
import { IUser } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'users.json';

// 시드 데이터 (최초 실행 시 users.json이 없을 때만 사용)
const ARR_SEED: IUser[] = [
  { nId: 1, strUserId: 'admin', strPassword: '__PENDING__', strDisplayName: '관리자',    arrRoles: ['admin'],        dtCreatedAt: new Date() },
  { nId: 2, strUserId: 'gm01',  strPassword: '__PENDING__', strDisplayName: 'GM_홍길동',  arrRoles: ['game_manager'], dtCreatedAt: new Date() },
  { nId: 3, strUserId: 'dba01', strPassword: '__PENDING__', strDisplayName: 'DBA_김철수', arrRoles: ['dba'],          dtCreatedAt: new Date() },
];

export const arrUsers: IUser[] = fnLoadJson<IUser>(STR_FILE, ARR_SEED);

// 서버 시작 시 비밀번호 해시 초기화 (플레이스홀더인 경우에만)
export const fnInitUsers = async () => {
  let bChanged = false;
  const OBJ_DEFAULT_PASSWORDS: Record<string, string> = {
    admin: 'admin123',
    gm01:  'gm123',
    dba01: 'dba123',
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

export const fnSaveUsers = () => fnSaveJson(STR_FILE, arrUsers);

export const fnGetNextId = (): number =>
  arrUsers.length > 0 ? Math.max(...arrUsers.map((u) => u.nId)) + 1 : 1;
