import bcrypt from 'bcryptjs';
import { IUser } from '../types';

// 임시 사용자 데이터 저장소 (추후 DB 연동 시 교체)
export const arrUsers: IUser[] = [
  {
    nId: 1,
    strUserId: 'admin',
    strPassword: '$2a$10$placeholder',
    strDisplayName: '관리자',
    strRole: 'admin',
    dtCreatedAt: new Date(),
  },
  {
    nId: 2,
    strUserId: 'gm01',
    strPassword: '$2a$10$placeholder',
    strDisplayName: 'GM_홍길동',
    strRole: 'gm',
    dtCreatedAt: new Date(),
  },
];

// 서버 시작 시 기본 계정 비밀번호 해싱
export const fnInitUsers = async () => {
  const strAdminHash = await bcrypt.hash('admin123', 10);
  const strGmHash = await bcrypt.hash('gm123', 10);
  arrUsers[0].strPassword = strAdminHash;
  arrUsers[1].strPassword = strGmHash;
};

// 다음 ID 자동 생성
export const fnGetNextId = (): number => {
  return arrUsers.length > 0 ? Math.max(...arrUsers.map((u) => u.nId)) + 1 : 1;
};
