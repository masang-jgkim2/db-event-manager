import { fnPersistAuthDomainToRdb } from './rolesUsersPersistence';

/** 역할·권한·사용자·user_roles 메모리 → RDB (순환 import 방지용 동적 묶음) */
export const fnFlushAuthDomainToRdb = async (): Promise<void> => {
  const { arrRoles } = await import('../../data/roles');
  const { arrRolePermissions } = await import('../../data/rolePermissions');
  const { arrUsers } = await import('../../data/users');
  const { arrUserRoles } = await import('../../data/userRoles');
  await fnPersistAuthDomainToRdb({ arrRoles, arrRolePermissions, arrUsers, arrUserRoles });
};
