/**
 * nServiceId backfill — products.arrServices, db_connection, event_instance
 * 사용: npm run backfill-service-ids  (backend, .env 동일)
 * 주의: 실행 중 백엔드가 있으면 재시작 후 확인
 */
import '../loadEnv';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnReadJsonArrayFromDiskRaw, fnMirrorJsonToDisk, fnSaveJson } from '../data/jsonStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import { fnRelationalLoadProducts } from '../db/mysqlRelationalSync';
import type { IProduct } from '../data/products';
import type { IDbConnection } from '../types';
import type { IEventInstance } from '../data/eventInstances';
import {
  fnEnsureAllProductsServiceIds,
  fnResolveServiceIdFromAbbr,
} from '../utils/serviceId';

const fnLoadProducts = async (pool: Pool | null): Promise<IProduct[]> => {
  if (fnIsMysqlStore() && pool) {
    await fnEnsureMysqlAppSchema(pool);
    return fnRelationalLoadProducts(pool);
  }
  return fnReadJsonArrayFromDiskRaw<IProduct>('products.json') ?? [];
};

const fnBackfillConnections = (arrProducts: IProduct[], arrConns: IDbConnection[]): number => {
  let n = 0;
  for (const objConn of arrConns) {
    const nResolved = fnResolveServiceIdFromAbbr(
      objConn.nProductId,
      objConn.strServiceAbbr,
      arrProducts,
    );
    if (nResolved && objConn.nServiceId !== nResolved) {
      objConn.nServiceId = nResolved;
      n += 1;
    }
  }
  return n;
};

const fnBackfillInstances = (arrProducts: IProduct[], arrInst: IEventInstance[]): number => {
  let n = 0;
  for (const objInst of arrInst) {
    const nResolved = fnResolveServiceIdFromAbbr(
      objInst.nProductId,
      objInst.strServiceAbbr,
      arrProducts,
    );
    if (nResolved && objInst.nServiceId !== nResolved) {
      objInst.nServiceId = nResolved;
      n += 1;
    }
  }
  return n;
};

const fnSyncProductServicesToMysql = async (
  conn: PoolConnection,
  arrProducts: IProduct[],
): Promise<void> => {
  for (const objProd of arrProducts) {
    await conn.execute('DELETE FROM product_service WHERE n_product_id = ?', [objProd.nId]);
    let nSort = 0;
    for (const objSvc of objProd.arrServices ?? []) {
      const nSvcId = Number(objSvc.nServiceId);
      if (!nSvcId) continue;
      await conn.execute(
        `INSERT INTO product_service (n_id, n_product_id, n_sort, str_abbr, str_region) VALUES (?,?,?,?,?)`,
        [nSvcId, objProd.nId, nSort, objSvc.strAbbr, objSvc.strRegion],
      );
      nSort += 1;
    }
  }
};

const fnPersistToMysql = async (
  pool: Pool,
  arrProducts: IProduct[],
  arrConns: IDbConnection[],
  arrInst: IEventInstance[],
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await fnSyncProductServicesToMysql(conn, arrProducts);
    for (const c of arrConns) {
      await conn.execute(
        `UPDATE db_connection SET n_service_id = ?, str_service_abbr = ? WHERE n_id = ?`,
        [c.nServiceId ?? null, (c.strServiceAbbr ?? '').trim() || null, c.nId],
      );
    }
    for (const inst of arrInst) {
      await conn.execute(`UPDATE event_instance SET n_service_id = ? WHERE n_id = ?`, [
        inst.nServiceId ?? null,
        inst.nId,
      ]);
    }
    await conn.commit();
    console.log('[backfill-service-ids] MySQL 반영 완료');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const fnMain = async (): Promise<void> => {
  const pool = fnIsMysqlStore() ? fnGetMysqlAppPool() : null;
  let arrProducts = await fnLoadProducts(pool);
  let arrConns = fnReadJsonArrayFromDiskRaw<IDbConnection>('dbConnections.json') ?? [];
  let arrInst = fnReadJsonArrayFromDiskRaw<IEventInstance>('eventInstances.json') ?? [];

  const bProd = fnEnsureAllProductsServiceIds(arrProducts);
  const nConn = fnBackfillConnections(arrProducts, arrConns);
  const nInst = fnBackfillInstances(arrProducts, arrInst);

  fnMirrorJsonToDisk('products.json', arrProducts);
  fnMirrorJsonToDisk('dbConnections.json', arrConns);
  fnMirrorJsonToDisk('eventInstances.json', arrInst);

  if (!fnIsMysqlStore()) {
    fnSaveJson('products.json', arrProducts);
    fnSaveJson('dbConnections.json', arrConns);
    fnSaveJson('eventInstances.json', arrInst);
  }

  if (pool) {
    await fnPersistToMysql(pool, arrProducts, arrConns, arrInst);
  }

  console.log(
    `[backfill-service-ids] 완료 | products=${bProd ? 'ID부여' : '유지'} dbConn=${nConn}건 instance=${nInst}건`,
  );
  console.log('[backfill-service-ids] 실행 중 백엔드가 있으면 재시작하세요.');
};

void fnMain().catch((err: unknown) => {
  console.error('[backfill-service-ids] 실패 |', err instanceof Error ? err.message : err);
  process.exit(1);
});
