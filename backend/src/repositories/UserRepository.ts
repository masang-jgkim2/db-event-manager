import { IUser } from '../types';
import {
  arrUsers,
  fnFindUserByStrUserId,
  fnFindUserRowById,
  fnGetNextId,
  fnGetUsersWithRoles,
  fnSaveUserAndRoles,
  fnSaveUsers,
} from '../data/users';
import { fnGetRoleIdsByRoleCodes } from '../data/roles';
import { fnRemoveUserRolesAndSave } from '../data/userRoles';

// 사용자 Repository — 정규화 데이터 레이어 사용 (역할은 user_roles에서 조립)
export class UserRepository {
  async findAll(): Promise<IUser[]> {
    return fnGetUsersWithRoles();
  }

  async findById(nId: number): Promise<IUser | null> {
    return fnGetUsersWithRoles().find((u) => u.nId === nId) ?? null;
  }

  async findByUserId(strUserId: string): Promise<IUser | null> {
    return fnFindUserByStrUserId(strUserId) ?? null;
  }

  async create(objData: Omit<IUser, 'nId'>): Promise<IUser> {
    const nId = fnGetNextId();
    arrUsers.push({
      nId,
      strUserId: objData.strUserId,
      strPassword: (objData as any).strPassword ?? '',
      strDisplayName: objData.strDisplayName,
      dtCreatedAt: (objData as any).dtCreatedAt instanceof Date
        ? (objData as any).dtCreatedAt.toISOString()
        : new Date().toISOString(),
    });
    const arrRoleIds = fnGetRoleIdsByRoleCodes(objData.arrRoles ?? []);
    await fnSaveUserAndRoles(nId, arrRoleIds);
    return (await this.findById(nId))!;
  }

  async update(nId: number, objData: Partial<IUser>): Promise<IUser | null> {
    const row = fnFindUserRowById(nId);
    if (!row) return null;
    if (objData.strDisplayName !== undefined) row.strDisplayName = objData.strDisplayName;
    if ((objData as any).strPassword !== undefined) row.strPassword = (objData as any).strPassword;
    if (objData.arrRoles !== undefined) {
      const arrRoleIds = fnGetRoleIdsByRoleCodes(objData.arrRoles);
      await fnSaveUserAndRoles(nId, arrRoleIds);
    } else {
      await fnSaveUsers();
    }
    return this.findById(nId);
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrUsers.findIndex((u) => u.nId === nId);
    if (nIdx === -1) return false;
    await fnRemoveUserRolesAndSave(nId);
    arrUsers.splice(nIdx, 1);
    await fnSaveUsers();
    return true;
  }
}

export const userRepository = new UserRepository();
