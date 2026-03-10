import { IRole } from '../types';

// 역할 인메모리 저장소
export const arrRoles: IRole[] = [
  {
    nId: 1,
    strCode: 'admin',
    strDisplayName: '관리자',
    strDescription: '전체 시스템 관리 권한',
    arrPermissions: [
      'product.view',
      'product.manage',
      'event_template.view',
      'event_template.manage',
      'user.manage',
      'db.manage',
      'instance.create',
      'instance.approve_qa',
      'instance.execute_qa',
      'instance.verify_qa',
      'instance.approve_live',
      'instance.execute_live',
      'instance.verify_live',
    ],
    bIsSystem: true,
    dtCreatedAt: new Date().toISOString(),
    dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 2,
    strCode: 'dba',
    strDisplayName: 'DBA',
    strDescription: 'DB 쿼리 실행 전담',
    arrPermissions: [
      'instance.execute_qa',
      'instance.execute_live',
    ],
    bIsSystem: true,
    dtCreatedAt: new Date().toISOString(),
    dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 3,
    strCode: 'game_manager',
    strDisplayName: 'GM',
    strDescription: '게임 운영 관리자',
    arrPermissions: [
      'product.view',
      'event_template.view',
      'instance.create',
      'instance.approve_qa',
      'instance.verify_qa',
      'instance.approve_live',
      'instance.verify_live',
    ],
    bIsSystem: true,
    dtCreatedAt: new Date().toISOString(),
    dtUpdatedAt: new Date().toISOString(),
  },
  {
    nId: 4,
    strCode: 'game_designer',
    strDisplayName: '기획자',
    strDescription: '이벤트 기획 및 생성',
    arrPermissions: [
      'product.view',
      'event_template.view',
      'instance.create',
    ],
    bIsSystem: true,
    dtCreatedAt: new Date().toISOString(),
    dtUpdatedAt: new Date().toISOString(),
  },
];

// 다음 ID 자동 생성
export const fnGetNextRoleId = (): number => {
  return arrRoles.length > 0
    ? Math.max(...arrRoles.map((r) => r.nId)) + 1
    : 1;
};

// 역할 코드로 조회
export const fnFindRoleByCode = (strCode: string): IRole | undefined => {
  return arrRoles.find((r) => r.strCode === strCode);
};

// 역할 코드 배열에서 권한 합집합 계산
export const fnGetMergedPermissions = (arrRoleCodes: string[]): string[] => {
  const setPermissions = new Set<string>();
  for (const strCode of arrRoleCodes) {
    const objRole = fnFindRoleByCode(strCode);
    if (objRole) {
      objRole.arrPermissions.forEach((p) => setPermissions.add(p));
    }
  }
  return Array.from(setPermissions);
};
