import { IUser } from '../types';
import { arrUsers, fnGetNextId } from '../data/users';

// 사용자 Repository - 인메모리 구현체
export class UserRepository {
  async findAll(): Promise<IUser[]> {
    return [...arrUsers];
  }

  async findById(nId: number): Promise<IUser | null> {
    return arrUsers.find((u) => u.nId === nId) ?? null;
  }

  async findByUserId(strUserId: string): Promise<IUser | null> {
    return arrUsers.find((u) => u.strUserId === strUserId) ?? null;
  }

  async create(objData: Omit<IUser, 'nId'>): Promise<IUser> {
    const objNew: IUser = { nId: fnGetNextId(), ...objData };
    arrUsers.push(objNew);
    return objNew;
  }

  async update(nId: number, objData: Partial<IUser>): Promise<IUser | null> {
    const nIdx = arrUsers.findIndex((u) => u.nId === nId);
    if (nIdx === -1) return null;
    Object.assign(arrUsers[nIdx], objData);
    return arrUsers[nIdx];
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrUsers.findIndex((u) => u.nId === nId);
    if (nIdx === -1) return false;
    arrUsers.splice(nIdx, 1);
    return true;
  }
}

export const userRepository = new UserRepository();
