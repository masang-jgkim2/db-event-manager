/**
 * 아스다글로벌 중복 프로덕트 #9 → #4 통합
 * - nProductId=9 쿼리 템플릿 → 4
 * - 프로덕트 #9 삭제
 * 사용: npm run merge-asda-product-9-into-4  (backend, .env 동일)
 * 주의: 실행 중 백엔드가 있으면 메모리의 #9가 MySQL/JSON에 되돌아갈 수 있음 — 먼저 :4000 종료
 */
import '../loadEnv';
import type { Pool } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnReadJsonArrayFromDiskRaw, fnMirrorJsonToDisk, fnSaveJson } from '../data/jsonStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnEnsureMysqlAppSchema, fnMysqlLoadArrayByFilename } from '../db/mysqlAppDataAccess';
import { fnRelationalLoadProducts } from '../db/mysqlRelationalSync';
import type { IProduct } from '../data/products';
import type { IEventTemplate } from '../data/events';

const N_KEEP_PRODUCT_ID = 4;
const N_MERGE_PRODUCT_ID = 9;

const fnApplyMerge = (
  arrProducts: IProduct[],
  arrEvents: IEventTemplate[],
): { arrProducts: IProduct[]; arrEvents: IEventTemplate[]; nMovedTemplates: number; bRemovedProduct: boolean } => {
  const objKeep = arrProducts.find((p) => p.nId === N_KEEP_PRODUCT_ID);
  const objMerge = arrProducts.find((p) => p.nId === N_MERGE_PRODUCT_ID);
  if (!objKeep) {
    throw new Error(`프로덕트 #${N_KEEP_PRODUCT_ID}(아스다글로벌 유지)가 없습니다.`);
  }
  if (!objMerge) {
    return { arrProducts, arrEvents, nMovedTemplates: 0, bRemovedProduct: false };
  }

  let nMovedTemplates = 0;
  for (const objTpl of arrEvents) {
    if (objTpl.nProductId !== N_MERGE_PRODUCT_ID) continue;
    objTpl.nProductId = N_KEEP_PRODUCT_ID;
    objTpl.strProductName = objKeep.strName;
    nMovedTemplates += 1;
    console.log(`[merge-asda] 템플릿 #${objTpl.nId} → nProductId=${N_KEEP_PRODUCT_ID} | ${objTpl.strEventLabel}`);
  }

  const arrNextProducts = arrProducts.filter((p) => p.nId !== N_MERGE_PRODUCT_ID);
  return { arrProducts: arrNextProducts, arrEvents, nMovedTemplates, bRemovedProduct: true };
};

/** MySQL — product·event_template만 갱신 (전체 스냅샷은 role FK 등으로 실패할 수 있음) */
const fnPersistMergeToMysql = async (
  pool: Pool,
  strProductName: string,
  nMovedTemplates: number,
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (nMovedTemplates > 0) {
      const [res] = await conn.execute(
        `UPDATE event_template SET n_product_id = ?, str_product_name = ? WHERE n_product_id = ?`,
        [N_KEEP_PRODUCT_ID, strProductName, N_MERGE_PRODUCT_ID],
      );
      const nAffected = (res as { affectedRows?: number }).affectedRows ?? 0;
      console.log(`[merge-asda] MySQL event_template | ${nAffected}건 n_product_id → ${N_KEEP_PRODUCT_ID}`);
    }
    await conn.execute('DELETE FROM product_service WHERE n_product_id = ?', [N_MERGE_PRODUCT_ID]);
    const [delRes] = await conn.execute('DELETE FROM product WHERE n_id = ?', [N_MERGE_PRODUCT_ID]);
    const nDel = (delRes as { affectedRows?: number }).affectedRows ?? 0;
    if (nDel !== 1) {
      throw new Error(`프로덕트 #${N_MERGE_PRODUCT_ID} DELETE affectedRows=${nDel}`);
    }
    await conn.commit();
    console.log(`[merge-asda] MySQL product #${N_MERGE_PRODUCT_ID} 삭제 완료`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const fnMain = async (): Promise<void> => {
  let arrProducts: IProduct[];
  let arrEvents: IEventTemplate[];

  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    await fnEnsureMysqlAppSchema(pool);
    arrProducts = await fnRelationalLoadProducts(pool);
    arrEvents = (await fnMysqlLoadArrayByFilename(pool, 'events.json')) as IEventTemplate[];
    console.log(`[merge-asda] MySQL 로드 | products=${arrProducts.length} events=${arrEvents.length}`);
  } else {
    arrProducts = fnReadJsonArrayFromDiskRaw<IProduct>('products.json') ?? [];
    arrEvents = fnReadJsonArrayFromDiskRaw<IEventTemplate>('events.json') ?? [];
    console.log(`[merge-asda] JSON 로드 | products=${arrProducts.length} events=${arrEvents.length}`);
  }

  const objResult = fnApplyMerge(arrProducts, arrEvents);
  if (!objResult.bRemovedProduct) {
    console.log('[merge-asda] 프로덕트 #9 없음 — 이미 통합됨 또는 불필요');
    return;
  }

  const objKeep = objResult.arrProducts.find((p) => p.nId === N_KEEP_PRODUCT_ID)!;
  console.log(
    `[merge-asda] 템플릿 ${objResult.nMovedTemplates}건 이동, 프로덕트 #${N_MERGE_PRODUCT_ID} 삭제 예정`,
  );

  fnMirrorJsonToDisk('products.json', objResult.arrProducts);
  fnMirrorJsonToDisk('events.json', objResult.arrEvents);

  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    await fnPersistMergeToMysql(pool, objKeep.strName, objResult.nMovedTemplates);
  } else {
    fnSaveJson('products.json', objResult.arrProducts);
    fnSaveJson('events.json', objResult.arrEvents);
    console.log('[merge-asda] products.json · events.json 저장 완료');
  }

  console.log(
    `[merge-asda] 완료 | 유지=#${N_KEEP_PRODUCT_ID} | 실행 중 백엔드가 있으면 재시작 후 화면을 확인하세요.`,
  );
};

void fnMain().catch((err: unknown) => {
  console.error('[merge-asda] 실패 |', err instanceof Error ? err.message : err);
  process.exit(1);
});
