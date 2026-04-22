import { fnGetStoreBackend } from './storeBackend';
import { fnEnsureSystemDbForRdb } from './ensureSystemDb';
import { fnRunMigrations } from '../db/migrationRunner';
import { fnHydrateDbConnectionsFromRdb } from './rdb/dbConnectionsPersistence';
import { fnHydrateAuthDomainFromRdb } from './rdb/rolesUsersPersistence';
import { arrDbConnections } from '../data/dbConnections';
import { arrRoles } from '../data/roles';
import { arrRolePermissions } from '../data/rolePermissions';
import { arrUsers } from '../data/users';
import { arrUserRoles } from '../data/userRoles';
import { arrProducts } from '../data/products';
import { arrEvents } from '../data/events';
import { arrEventInstances } from '../data/eventInstances';
import { fnHydrateProductCatalogFromRdb } from './rdb/productCatalogPersistence';

/**
 * 앱 라우트 로드 전에 호출 — RDB 모드면 마이그레이션 후 db_connections·역할/사용자·카탈로그 하이드레이트.
 */
export const fnBootstrapPersistence = async (): Promise<void> => {
  const strMode = fnGetStoreBackend();
  console.log(`[persistence] STORE_BACKEND=${strMode}`);
  if (strMode === 'json') return;
  await fnEnsureSystemDbForRdb();
  await fnRunMigrations();
  await fnHydrateDbConnectionsFromRdb(arrDbConnections);
  await fnHydrateAuthDomainFromRdb(arrRoles, arrRolePermissions, arrUsers, arrUserRoles);
  await fnHydrateProductCatalogFromRdb(arrProducts, arrEvents, arrEventInstances);
};
