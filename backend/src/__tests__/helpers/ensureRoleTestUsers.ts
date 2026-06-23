/** API·Push 테스트용 — 시드는 admin만, GM/DBA/기획자는 테스트에서 보장 */
import bcrypt from 'bcryptjs';
import { arrUsers, fnInitUsers, fnSaveUsers } from '../../data/users';
import { arrUserRoles, fnSetRolesForUser, fnSaveUserRoles } from '../../data/userRoles';

const ARR_ROLE_TEST_USERS: Array<{
  nId: number;
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  nRoleId: number;
}> = [
  { nId: 2, strUserId: 'gm01', strPassword: 'gm123', strDisplayName: 'GM_홍길동', nRoleId: 3 },
  { nId: 3, strUserId: 'dba01', strPassword: 'dba123', strDisplayName: 'DBA_김철수', nRoleId: 2 },
  { nId: 4, strUserId: 'planner01', strPassword: 'planner123', strDisplayName: '기획자_이영희', nRoleId: 4 },
];

export const fnEnsureRoleTestUsers = async (): Promise<void> => {
  await fnInitUsers();
  for (const objDef of ARR_ROLE_TEST_USERS) {
    let objUser = arrUsers.find((u) => u.strUserId === objDef.strUserId);
    if (!objUser) {
      objUser = {
        nId: objDef.nId,
        strUserId: objDef.strUserId,
        strPassword: await bcrypt.hash(objDef.strPassword, 10),
        strDisplayName: objDef.strDisplayName,
        dtCreatedAt: new Date().toISOString(),
      };
      arrUsers.push(objUser);
    } else {
      objUser.strPassword = await bcrypt.hash(objDef.strPassword, 10);
    }
    if (!arrUserRoles.some((r) => r.nUserId === objDef.nId && r.nRoleId === objDef.nRoleId)) {
      fnSetRolesForUser(objDef.nId, [objDef.nRoleId]);
    }
  }
  fnSaveUsers();
  fnSaveUserRoles();
};
