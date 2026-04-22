import sql from 'mssql';
import { fnGetSystemPool } from '../../db/systemDb';
import type { IProduct } from '../../data/products';
import type { IEventTemplate } from '../../data/events';
import type { IEventInstance } from '../../data/eventInstances';

const fnCount = async (pool: sql.ConnectionPool, strTable: string): Promise<number> => {
  const r = await pool.request().query(`SELECT COUNT(*) AS c FROM dbo.${strTable}`);
  return Number((r.recordset as { c: number }[])[0]?.c ?? 0);
};

/**
 * RDB 카탈로그 → 메모리.
 * - 세 테이블 모두 0건: JSON 유지.
 * - FK·정합: `products`·`event_templates`가 둘 다 있을 때만 RDB 반영(인스턴스는 0건이면 메모리 비움).
 * - 그 외 부분 데이터(예: products만 있음): 하이드레이트 생략·JSON 유지.
 */
export const fnHydrateProductCatalogFromRdb = async (
  arrProducts: IProduct[],
  arrEvents: IEventTemplate[],
  arrEventInstances: IEventInstance[],
): Promise<void> => {
  const pool = await fnGetSystemPool();
  const nPc = await fnCount(pool, 'products');
  const nTc = await fnCount(pool, 'event_templates');
  const nIc = await fnCount(pool, 'event_instances');
  if (nPc === 0 && nTc === 0 && nIc === 0) {
    console.log('[persistence] product catalog | RDB 0건 — JSON 유지');
    return;
  }

  if (nPc === 0 && (nTc > 0 || nIc > 0)) {
    console.warn(
      '[persistence] product catalog | RDB 부분 데이터(products=0, templates/instances>0) — 하이드레이트 생략, JSON 유지',
    );
    return;
  }
  if (nIc > 0 && nTc === 0) {
    console.warn(
      '[persistence] product catalog | RDB 부분 데이터(event_templates=0, event_instances>0) — 하이드레이트 생략, JSON 유지',
    );
    return;
  }
  if (nPc > 0 && nTc === 0) {
    console.warn(
      '[persistence] product catalog | RDB 부분 데이터(products>0, event_templates=0) — 하이드레이트 생략, JSON 유지',
    );
    return;
  }

  if (nPc > 0) {
    const r = await pool.request().query(
      `SELECT n_id, str_name, str_description, str_db_type, arr_services, dt_created_at FROM dbo.products ORDER BY n_id`,
    );
    const arr = (r.recordset as Record<string, unknown>[]).map((row) => ({
      nId: Number(row.n_id),
      strName: String(row.str_name ?? ''),
      strDescription: String(row.str_description ?? ''),
      strDbType: String(row.str_db_type ?? ''),
      arrServices: JSON.parse(String(row.arr_services ?? '[]')) as IProduct['arrServices'],
      dtCreatedAt:
        row.dt_created_at instanceof Date
          ? row.dt_created_at.toISOString()
          : String(row.dt_created_at ?? ''),
    }));
    arrProducts.length = 0;
    arrProducts.push(...arr);
    console.log(`[persistence] products | RDB ${arr.length}건`);
  }

  if (nTc > 0) {
    const r = await pool.request().query(
      `SELECT n_id, n_product_id, str_product_name, str_event_label, str_description, str_category, str_type,
              str_input_format, str_default_items, str_query_template, arr_query_templates, dt_created_at
       FROM dbo.event_templates ORDER BY n_id`,
    );
    const arr = (r.recordset as Record<string, unknown>[]).map((row) => {
      const strArrQt = row.arr_query_templates;
      let arrQueryTemplates: IEventTemplate['arrQueryTemplates'];
      if (strArrQt != null && String(strArrQt).trim() !== '') {
        try {
          arrQueryTemplates = JSON.parse(String(strArrQt)) as IEventTemplate['arrQueryTemplates'];
        } catch {
          arrQueryTemplates = undefined;
        }
      }
      return {
        nId: Number(row.n_id),
        nProductId: Number(row.n_product_id),
        strProductName: String(row.str_product_name ?? ''),
        strEventLabel: String(row.str_event_label ?? ''),
        strDescription: String(row.str_description ?? ''),
        strCategory: String(row.str_category ?? ''),
        strType: String(row.str_type ?? ''),
        strInputFormat: String(row.str_input_format ?? ''),
        strDefaultItems: String(row.str_default_items ?? ''),
        strQueryTemplate: String(row.str_query_template ?? ''),
        arrQueryTemplates,
        dtCreatedAt:
          row.dt_created_at instanceof Date
            ? row.dt_created_at.toISOString()
            : String(row.dt_created_at ?? ''),
      } as IEventTemplate;
    });
    arrEvents.length = 0;
    arrEvents.push(...arr);
    console.log(`[persistence] event_templates | RDB ${arr.length}건`);
  }

  if (nIc > 0) {
    const r = await pool.request().query(
      `SELECT n_id, str_payload FROM dbo.event_instances ORDER BY n_id`,
    );
    const arr: IEventInstance[] = [];
    for (const row of r.recordset as { n_id: number; str_payload: string }[]) {
      try {
        arr.push(JSON.parse(row.str_payload) as IEventInstance);
      } catch (err) {
        console.error('[persistence] event_instances | JSON 파싱 실패 n_id=', row.n_id, err);
      }
    }
    arrEventInstances.length = 0;
    arrEventInstances.push(...arr);
    console.log(`[persistence] event_instances | RDB ${arr.length}건`);
  } else {
    arrEventInstances.length = 0;
    console.log('[persistence] event_instances | RDB 0건 — 메모리 비움');
  }
};

/** 인스턴스 → 템플릿 → 프로덕트 순 삽입 (FK). 저장 시 메모리 전체 스냅샷 */
export const fnPersistProductCatalogToRdb = async (obj: {
  arrProducts: IProduct[];
  arrEvents: IEventTemplate[];
  arrEventInstances: IEventInstance[];
}): Promise<void> => {
  const pool = await fnGetSystemPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    await new sql.Request(t).query('DELETE FROM dbo.event_instances');
    await new sql.Request(t).query('DELETE FROM dbo.event_templates');
    await new sql.Request(t).query('DELETE FROM dbo.products');

    for (const p of obj.arrProducts) {
      const rq = new sql.Request(t);
      rq.input('n_id', sql.Int, p.nId);
      rq.input('str_name', sql.NVarChar(200), p.strName);
      rq.input('str_description', sql.NVarChar(sql.MAX), p.strDescription);
      rq.input('str_db_type', sql.NVarChar(20), p.strDbType);
      rq.input('arr_services', sql.NVarChar(sql.MAX), JSON.stringify(p.arrServices ?? []));
      rq.input('dt_created_at', sql.DateTime2, new Date(p.dtCreatedAt));
      await rq.query(
        `INSERT INTO dbo.products (n_id, str_name, str_description, str_db_type, arr_services, dt_created_at)
         VALUES (@n_id, @str_name, @str_description, @str_db_type, @arr_services, @dt_created_at)`,
      );
    }

    for (const e of obj.arrEvents) {
      const rq = new sql.Request(t);
      rq.input('n_id', sql.Int, e.nId);
      rq.input('n_product_id', sql.Int, e.nProductId);
      rq.input('str_product_name', sql.NVarChar(200), e.strProductName);
      rq.input('str_event_label', sql.NVarChar(400), e.strEventLabel);
      rq.input('str_description', sql.NVarChar(sql.MAX), e.strDescription);
      rq.input('str_category', sql.NVarChar(100), e.strCategory);
      rq.input('str_type', sql.NVarChar(100), e.strType);
      rq.input('str_input_format', sql.NVarChar(100), e.strInputFormat);
      rq.input('str_default_items', sql.NVarChar(sql.MAX), e.strDefaultItems ?? '');
      rq.input('str_query_template', sql.NVarChar(sql.MAX), e.strQueryTemplate ?? '');
      const strQt =
        e.arrQueryTemplates && e.arrQueryTemplates.length > 0 ? JSON.stringify(e.arrQueryTemplates) : null;
      rq.input('arr_query_templates', sql.NVarChar(sql.MAX), strQt);
      rq.input('dt_created_at', sql.DateTime2, new Date(e.dtCreatedAt));
      await rq.query(
        `INSERT INTO dbo.event_templates (
           n_id, n_product_id, str_product_name, str_event_label, str_description, str_category, str_type,
           str_input_format, str_default_items, str_query_template, arr_query_templates, dt_created_at
         ) VALUES (
           @n_id, @n_product_id, @str_product_name, @str_event_label, @str_description, @str_category, @str_type,
           @str_input_format, @str_default_items, @str_query_template, @arr_query_templates, @dt_created_at
         )`,
      );
    }

    for (const inst of obj.arrEventInstances) {
      const rq = new sql.Request(t);
      rq.input('n_id', sql.Int, inst.nId);
      rq.input('str_payload', sql.NVarChar(sql.MAX), JSON.stringify(inst));
      await rq.query(`INSERT INTO dbo.event_instances (n_id, str_payload) VALUES (@n_id, @str_payload)`);
    }

    await t.commit();
    console.log(
      `[persistence] product catalog | RDB 저장 products=${obj.arrProducts.length} templates=${obj.arrEvents.length} instances=${obj.arrEventInstances.length}`,
    );
  } catch (err) {
    await t.rollback();
    throw err;
  }
};
