import { IRole } from '../types';
import { arrRoles, fnGetNextRoleId } from '../data/roles';

// 역할 Repository - 인메모리 구현체
export class RoleRepository {
  async findAll(): Promise<IRole[]> {
    return [...arrRoles];
  }

  async findById(nId: number): Promise<IRole | null> {
    return arrRoles.find((r) => r.nId === nId) ?? null;
  }

  async findByCode(strCode: string): Promise<IRole | null> {
    return arrRoles.find((r) => r.strCode === strCode) ?? null;
  }

  async create(objData: Omit<IRole, 'nId'>): Promise<IRole> {
    const objNew: IRole = { nId: fnGetNextRoleId(), ...objData };
    arrRoles.push(objNew);
    return objNew;
  }

  async update(nId: number, objData: Partial<IRole>): Promise<IRole | null> {
    const nIdx = arrRoles.findIndex((r) => r.nId === nId);
    if (nIdx === -1) return null;
    Object.assign(arrRoles[nIdx], { ...objData, dtUpdatedAt: new Date().toISOString() });
    return arrRoles[nIdx];
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrRoles.findIndex((r) => r.nId === nId);
    if (nIdx === -1) return false;
    arrRoles.splice(nIdx, 1);
    return true;
  }
}

export const roleRepository = new RoleRepository();
