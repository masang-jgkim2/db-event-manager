import { TPermission } from '../types';

// 역할별 기본 권한 매핑
export const OBJ_DEFAULT_PERMISSIONS: Record<string, TPermission[]> = {
  admin: [
    'product.manage',
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
  gm: [
    'instance.create',
    'instance.approve_qa',
    'instance.verify_qa',
    'instance.approve_live',
    'instance.verify_live',
  ],
  planner: [
    'instance.create',
  ],
  dba: [
    'instance.execute_qa',
    'instance.execute_live',
  ],
};

// 역할의 기본 권한 반환
export const fnGetDefaultPermissions = (strRole: string): TPermission[] => {
  return OBJ_DEFAULT_PERMISSIONS[strRole] || [];
};
