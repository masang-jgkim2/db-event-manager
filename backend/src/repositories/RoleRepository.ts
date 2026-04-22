import { IRole, TPermission } from '../types';
import {
  arrRoles,
  fnFindRoleRowById,
  fnGetNextRoleId,
  fnGetRolesWithPermissions,
  fnRemoveRolePermissionsAndSave,
  fnSaveRoleAndPermissions,
  fnSaveRoles,
} from '../data/roles';

// 역할 Repository — 정규화 데이터 레이어 사용 (권한은 role_permissions에서 조립)
export class RoleRepository {
  async findAll(): Promise<IRole[]> {
    return fnGetRolesWithPermissions();
  }

  async findById(nId: number): Promise<IRole | null> {
    return fnGetRolesWithPermissions().find((r) => r.nId === nId) ?? null;
  }

  async findByCode(strCode: string): Promise<IRole | null> {
    return fnGetRolesWithPermissions().find((r) => r.strCode === strCode) ?? null;
  }

  async create(objData: Omit<IRole, 'nId'>): Promise<IRole> {
    const nId = fnGetNextRoleId();
    const strNow = new Date().toISOString();
    arrRoles.push({
      nId,
      strCode: objData.strCode,
      strDisplayName: objData.strDisplayName,
      strDescription: objData.strDescription,
      bIsSystem: objData.bIsSystem,
      dtCreatedAt: objData.dtCreatedAt ?? strNow,
      dtUpdatedAt: objData.dtUpdatedAt ?? strNow,
    });
    await fnSaveRoleAndPermissions(nId, objData.arrPermissions ?? []);
    return (await this.findById(nId))!;
  }

  async update(nId: number, objData: Partial<IRole>): Promise<IRole | null> {
    const row = fnFindRoleRowById(nId);
    if (!row) return null;
    if (objData.strCode !== undefined) row.strCode = objData.strCode;
    if (objData.strDisplayName !== undefined) row.strDisplayName = objData.strDisplayName;
    if (objData.strDescription !== undefined) row.strDescription = objData.strDescription;
    if (objData.bIsSystem !== undefined) row.bIsSystem = objData.bIsSystem;
    row.dtUpdatedAt = new Date().toISOString();
    if (objData.arrPermissions !== undefined) {
      await fnSaveRoleAndPermissions(nId, objData.arrPermissions as TPermission[]);
    } else {
      await fnSaveRoles();
    }
    return this.findById(nId);
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrRoles.findIndex((r) => r.nId === nId);
    if (nIdx === -1) return false;
    await fnRemoveRolePermissionsAndSave(nId);
    arrRoles.splice(nIdx, 1);
    await fnSaveRoles();
    return true;
  }
}

export const roleRepository = new RoleRepository();
