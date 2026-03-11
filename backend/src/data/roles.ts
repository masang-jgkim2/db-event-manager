import { IRole } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'roles.json';

const ARR_SEED: IRole[] = [
  {
    nId: 1, strCode: 'admin', strDisplayName: '관리자',
    strDescription: '전체 시스템 관리 권한',
    arrPermissions: [
      'product.view','product.manage','event_template.view','event_template.manage',
      'user.manage','db.manage','instance.create','instance.approve_qa',
      'instance.execute_qa','instance.verify_qa','instance.approve_live',
      'instance.execute_live','instance.verify_live',
    ],
    bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 2, strCode: 'dba', strDisplayName: 'DBA',
    strDescription: 'DB 쿼리 실행 전담',
    arrPermissions: ['instance.execute_qa','instance.execute_live'],
    bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 3, strCode: 'game_manager', strDisplayName: 'GM',
    strDescription: '게임 운영 관리자',
    arrPermissions: [
      'product.view','event_template.view','instance.create',
      'instance.approve_qa','instance.verify_qa','instance.approve_live','instance.verify_live',
    ],
    bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 4, strCode: 'game_designer', strDisplayName: '기획자',
    strDescription: '이벤트 기획 및 생성',
    arrPermissions: ['product.view','event_template.view','instance.create'],
    bIsSystem: true, dtCreatedAt: new Date().toISOString(), dtUpdatedAt: new Date().toISOString(),
  },
];

export const arrRoles: IRole[] = fnLoadJson<IRole>(STR_FILE, ARR_SEED);

export const fnSaveRoles = () => fnSaveJson(STR_FILE, arrRoles);

export const fnGetNextRoleId = (): number =>
  arrRoles.length > 0 ? Math.max(...arrRoles.map((r) => r.nId)) + 1 : 1;

export const fnFindRoleByCode = (strCode: string): IRole | undefined =>
  arrRoles.find((r) => r.strCode === strCode);

export const fnGetMergedPermissions = (arrRoleCodes: string[]): string[] => {
  const setPermissions = new Set<string>();
  for (const strCode of arrRoleCodes) {
    const objRole = fnFindRoleByCode(strCode);
    if (objRole) objRole.arrPermissions.forEach((p) => setPermissions.add(p));
  }
  return Array.from(setPermissions);
};
