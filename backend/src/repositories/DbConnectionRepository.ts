import { IDbConnection } from '../types';
import { arrDbConnections, fnGetNextDbConnectionId } from '../data/dbConnections';

// DB 접속 정보 Repository - 인메모리 구현체
export class DbConnectionRepository {
  async findAll(): Promise<IDbConnection[]> {
    return [...arrDbConnections];
  }

  async findById(nId: number): Promise<IDbConnection | null> {
    return arrDbConnections.find((c) => c.nId === nId) ?? null;
  }

  async findActive(nProductId: number, strEnv: 'dev' | 'qa' | 'live'): Promise<IDbConnection | null> {
    return arrDbConnections.find(
      (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.bIsActive
    ) ?? null;
  }

  async create(objData: Omit<IDbConnection, 'nId'>): Promise<IDbConnection> {
    const objNew: IDbConnection = { nId: fnGetNextDbConnectionId(), ...objData };
    arrDbConnections.push(objNew);
    return objNew;
  }

  async update(nId: number, objData: Partial<IDbConnection>): Promise<IDbConnection | null> {
    const nIdx = arrDbConnections.findIndex((c) => c.nId === nId);
    if (nIdx === -1) return null;
    Object.assign(arrDbConnections[nIdx], { ...objData, dtUpdatedAt: new Date().toISOString() });
    return arrDbConnections[nIdx];
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrDbConnections.findIndex((c) => c.nId === nId);
    if (nIdx === -1) return false;
    arrDbConnections.splice(nIdx, 1);
    return true;
  }
}

export const dbConnectionRepository = new DbConnectionRepository();
