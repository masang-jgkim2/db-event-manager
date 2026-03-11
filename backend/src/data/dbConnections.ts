import { IDbConnection } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'dbConnections.json';

export const arrDbConnections: IDbConnection[] = fnLoadJson<IDbConnection>(STR_FILE, []);

export const fnSaveDbConnections = () => fnSaveJson(STR_FILE, arrDbConnections);

export const fnGetNextDbConnectionId = (): number =>
  arrDbConnections.length > 0 ? Math.max(...arrDbConnections.map((c) => c.nId)) + 1 : 1;

export const fnFindActiveConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live'
): IDbConnection | undefined =>
  arrDbConnections.find(
    (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.bIsActive
  );
