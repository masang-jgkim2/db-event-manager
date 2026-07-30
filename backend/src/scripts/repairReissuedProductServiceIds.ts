/**
 * 약자 변경으로 재발급된 product_service.n_id 복구
 * 대상: 출조낚시왕, 콜오브카오스, 스키드러시, 라그하임
 *
 * 사용 (backend, .env 동일):
 *   npx tsx src/scripts/repairReissuedProductServiceIds.ts           # dry-run
 *   npx tsx src/scripts/repairReissuedProductServiceIds.ts --apply   # 반영
 *   npm run repair-reissued-service-ids
 *   npm run repair-reissued-service-ids -- --apply
 *
 * 주의: apply 전 백엔드 중지. 반영 후 재시작.
 * ID 숫자는 환경마다 다를 수 있어 하드코딩하지 않음 — 접속·인스턴스 참조로 추론.
 */
import '../loadEnv';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnReadJsonArrayFromDiskRaw, fnMirrorJsonToDisk, fnSaveJson } from '../data/jsonStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import {
  fnRelationalLoadDbConnections,
  fnRelationalLoadEventInstances,
  fnRelationalLoadProducts,
} from '../db/mysqlRelationalSync';
import type { IProduct } from '../data/products';
import type { IEventInstance } from '../data/eventInstances';
import type { IDbConnection } from '../types';
import {
  ARR_REPAIR_PRODUCT_NAMES,
  fnApplyRemapsToConnectionsAbbr,
  fnApplyRemapsToProducts,
  fnPlanReissuedServiceIdRemaps,
  type TServiceIdRemap,
} from '../utils/repairReissuedServiceIds';

const bApply = process.argv.includes('--apply');

const fnLoadAll = async (): Promise<{
  arrProducts: IProduct[];
  arrConnections: IDbConnection[];
  arrInstances: IEventInstance[];
  pool: Pool | null;
}> => {
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    await fnEnsureMysqlAppSchema(pool);
    const arrProducts = await fnRelationalLoadProducts(pool);
    const arrConnections = await fnRelationalLoadDbConnections(pool);
    const arrInstances = await fnRelationalLoadEventInstances(pool);
    console.log(
      `[repair-service-ids] MySQL 로드 | products=${arrProducts.length} ` +
        `dbConn=${arrConnections.length} instances=${arrInstances.length}`,
    );
    return { arrProducts, arrConnections, arrInstances, pool };
  }
  const arrProducts = fnReadJsonArrayFromDiskRaw<IProduct>('products.json') ?? [];
  const arrConnections = fnReadJsonArrayFromDiskRaw<IDbConnection>('dbConnections.json') ?? [];
  const arrInstances = fnReadJsonArrayFromDiskRaw<IEventInstance>('eventInstances.json') ?? [];
  console.log(
    `[repair-service-ids] JSON 로드 | products=${arrProducts.length} ` +
      `dbConn=${arrConnections.length} instances=${arrInstances.length}`,
  );
  return { arrProducts, arrConnections, arrInstances, pool: null };
};

const fnPrintPlan = (arrRemaps: TServiceIdRemap[]): void => {
  console.log('[repair-service-ids] --- remap 계획 ---');
  for (const r of arrRemaps) {
    console.log(
      `  ${r.strProductName}(#${r.nProductId}) ${r.strAbbr}/${r.strRegion}: ` +
        `#${r.nFromId} → #${r.nToId} | conn참조=${r.nConnRefs} inst참조=${r.nInstRefs}`,
    );
  }
};

const fnAssertNoTargetCollision = async (
  conn: PoolConnection,
  arrRemaps: readonly TServiceIdRemap[],
): Promise<void> => {
  for (const r of arrRemaps) {
    const [arrRows] = await conn.query<RowDataPacket[]>(
      'SELECT n_id, n_product_id, str_abbr FROM product_service WHERE n_id = ?',
      [r.nToId],
    );
    if (arrRows.length === 0) continue;
    const objRow = arrRows[0];
    if (Number(objRow.n_product_id) === r.nProductId && Number(objRow.n_id) === r.nFromId) continue;
    if (Number(objRow.n_id) === r.nToId && Number(objRow.n_product_id) === r.nProductId) {
      // 이미 복구된 경우
      continue;
    }
    throw new Error(
      `복구 ID #${r.nToId} 충돌 | product_service n_product_id=${objRow.n_product_id} abbr=${objRow.str_abbr}`,
    );
  }
};

const fnPersistMysql = async (pool: Pool, arrRemaps: readonly TServiceIdRemap[]): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await fnAssertNoTargetCollision(conn, arrRemaps);

    for (const r of arrRemaps) {
      // PK 변경: 대상 ID가 없어야 함
      const [arrExistTo] = await conn.query<RowDataPacket[]>(
        'SELECT n_id FROM product_service WHERE n_id = ?',
        [r.nToId],
      );
      if (arrExistTo.length > 0) {
        throw new Error(`${r.strProductName}: 복구 대상 ID #${r.nToId}가 이미 product_service에 존재`);
      }

      const [arrFrom] = await conn.query<RowDataPacket[]>(
        'SELECT n_id, n_product_id, n_sort, str_abbr, str_region FROM product_service WHERE n_id = ? AND n_product_id = ?',
        [r.nFromId, r.nProductId],
      );
      if (arrFrom.length !== 1) {
        throw new Error(
          `${r.strProductName}: 현재 서비스 #${r.nFromId} 행을 찾을 수 없음 (count=${arrFrom.length})`,
        );
      }
      const objFrom = arrFrom[0];
      const nSort = Number(objFrom.n_sort) || 0;

      await conn.execute('DELETE FROM product_service WHERE n_id = ? AND n_product_id = ?', [
        r.nFromId,
        r.nProductId,
      ]);
      await conn.execute(
        `INSERT INTO product_service (n_id, n_product_id, n_sort, str_abbr, str_region) VALUES (?,?,?,?,?)`,
        [r.nToId, r.nProductId, nSort, r.strAbbr, r.strRegion],
      );

      // 접속 약자만 현재 약자로 (n_service_id는 이미 복구 ID)
      const [objUpd] = await conn.execute(
        `UPDATE db_connection
         SET str_service_abbr = ?
         WHERE n_product_id = ? AND n_service_id = ?`,
        [r.strAbbr, r.nProductId, r.nToId],
      );
      const nAffected = (objUpd as { affectedRows?: number }).affectedRows ?? 0;
      console.log(
        `[repair-service-ids] MySQL | ${r.strProductName} #${r.nFromId}→#${r.nToId} | abbr갱신 conn=${nAffected}`,
      );
    }

    const [arrMax] = await conn.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(n_id), 0) AS n_max FROM product_service',
    );
    const nNext = Number(arrMax[0]?.n_max ?? 0) + 1;
    await conn.query(`ALTER TABLE product_service AUTO_INCREMENT = ${nNext}`);

    await conn.commit();
    console.log(`[repair-service-ids] MySQL 반영 완료 | AUTO_INCREMENT=${nNext}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const fnMain = async (): Promise<void> => {
  console.log(
    `[repair-service-ids] mode=${bApply ? 'APPLY' : 'DRY-RUN'} | 대상=${ARR_REPAIR_PRODUCT_NAMES.join(', ')}`,
  );
  console.log('[repair-service-ids] apply 전 백엔드를 중지하세요.');

  const { arrProducts, arrConnections, arrInstances, pool } = await fnLoadAll();
  const objPlan = fnPlanReissuedServiceIdRemaps(
    arrProducts,
    arrConnections,
    arrInstances,
    ARR_REPAIR_PRODUCT_NAMES,
  );

  for (const str of objPlan.arrSkipped) {
    console.log(`[repair-service-ids] skip | ${str}`);
  }
  for (const str of objPlan.arrErrors) {
    console.error(`[repair-service-ids] error | ${str}`);
  }
  if (objPlan.arrErrors.length > 0) {
    throw new Error(`계획 오류 ${objPlan.arrErrors.length}건 — 수동 확인 후 재실행`);
  }
  if (objPlan.arrRemaps.length === 0) {
    console.log('[repair-service-ids] 복구할 remap 없음');
    return;
  }

  fnPrintPlan(objPlan.arrRemaps);

  if (!bApply) {
    console.log('[repair-service-ids] dry-run 종료. 반영: --apply');
    return;
  }

  fnApplyRemapsToProducts(arrProducts, objPlan.arrRemaps);
  const nAbbr = fnApplyRemapsToConnectionsAbbr(arrConnections, objPlan.arrRemaps);

  fnMirrorJsonToDisk('products.json', arrProducts);
  fnMirrorJsonToDisk('dbConnections.json', arrConnections);

  if (pool) {
    await fnPersistMysql(pool, objPlan.arrRemaps);
    await pool.end();
  } else {
    fnSaveJson('products.json', arrProducts);
    fnSaveJson('dbConnections.json', arrConnections);
    console.log(`[repair-service-ids] JSON 저장 | abbr갱신=${nAbbr}`);
  }

  console.log('[repair-service-ids] 완료. 백엔드를 재시작하세요.');
};

void fnMain().catch((err: unknown) => {
  console.error('[repair-service-ids] 실패 |', err instanceof Error ? err.message : err);
  process.exit(1);
});
