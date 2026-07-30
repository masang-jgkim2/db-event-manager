import {
  ARR_REPAIR_PRODUCT_NAMES,
  fnApplyRemapsToConnectionsAbbr,
  fnApplyRemapsToProducts,
  fnPlanReissuedServiceIdRemaps,
} from '../utils/repairReissuedServiceIds';
import type { IProduct } from '../data/products';
import type { IDbConnection } from '../types';
import type { IEventInstance } from '../data/eventInstances';

describe('repairReissuedServiceIds', () => {
  const fnProd = (nId: number, strName: string, nServiceId: number, strAbbr: string): IProduct => ({
    nId,
    strName,
    strDescription: '',
    strDbType: 'mssql',
    arrServices: [{ nServiceId, strAbbr, strRegion: '국내' }],
    dtCreatedAt: '2026-01-01T00:00:00.000Z',
  });

  const fnConn = (
    nId: number,
    nProductId: number,
    nServiceId: number,
    strServiceAbbr: string,
  ): IDbConnection => ({
    nId,
    nProductId,
    strProductName: '',
    nServiceId,
    strServiceAbbr,
    strKind: 'GAME',
    strEnv: 'qa',
    strDbType: 'mssql',
    strHost: 'h',
    nPort: 1433,
    strDatabase: 'db',
    strUser: 'u',
    strPassword: 'p',
    bIsActive: true,
    dtCreatedAt: '2026-01-01T00:00:00.000Z',
    dtUpdatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('대상 프로덕트명 4개', () => {
    expect(ARR_REPAIR_PRODUCT_NAMES).toEqual([
      '출조낚시왕',
      '콜오브카오스',
      '스키드러시',
      '라그하임',
    ]);
  });

  it('접속이 옛 ID를 가리키면 product #19 → #1 계획', () => {
    const arrProducts = [fnProd(1, '출조낚시왕', 19, 'FH/KR')];
    const arrConns = [fnConn(10, 1, 1, 'FH'), fnConn(11, 1, 1, 'FH')];
    const arrInst: IEventInstance[] = [];
    const objPlan = fnPlanReissuedServiceIdRemaps(arrProducts, arrConns, arrInst);
    expect(objPlan.arrErrors).toEqual([]);
    expect(objPlan.arrRemaps).toHaveLength(1);
    expect(objPlan.arrRemaps[0]).toMatchObject({
      nFromId: 19,
      nToId: 1,
      strAbbr: 'FH/KR',
      nConnRefs: 2,
    });
  });

  it('라그하임 포함 다수 프로덕트', () => {
    const arrProducts = [
      fnProd(1, '출조낚시왕', 19, 'FH/KR'),
      fnProd(3, '콜오브카오스', 20, 'CC/KR'),
      fnProd(7, '스키드러시', 21, 'SR'),
      fnProd(6, '라그하임', 22, 'LH/KR'),
    ];
    const arrConns = [
      fnConn(1, 1, 1, 'FH'),
      fnConn(2, 3, 3, 'CC'),
      fnConn(3, 7, 7, 'SR'),
      fnConn(4, 6, 6, 'LH'),
    ];
    const objPlan = fnPlanReissuedServiceIdRemaps(arrProducts, arrConns, []);
    expect(objPlan.arrErrors).toEqual([]);
    expect(objPlan.arrRemaps.map((r) => `${r.strProductName}:${r.nFromId}->${r.nToId}`).sort()).toEqual([
      '라그하임:22->6',
      '스키드러시:21->7',
      '출조낚시왕:19->1',
      '콜오브카오스:20->3',
    ]);
  });

  it('orphan ID 다수면 오류', () => {
    const arrProducts = [fnProd(1, '출조낚시왕', 19, 'FH/KR')];
    const arrConns = [fnConn(10, 1, 1, 'FH'), fnConn(11, 1, 2, 'FH')];
    const objPlan = fnPlanReissuedServiceIdRemaps(arrProducts, arrConns, []);
    expect(objPlan.arrRemaps).toHaveLength(0);
    expect(objPlan.arrErrors.some((s) => s.includes('orphan ID 다수'))).toBe(true);
  });

  it('apply helpers — products ID·접속 약자', () => {
    const arrProducts = [fnProd(1, '출조낚시왕', 19, 'FH/KR')];
    const arrConns = [fnConn(10, 1, 1, 'FH')];
    const arrRemaps = fnPlanReissuedServiceIdRemaps(arrProducts, arrConns, []).arrRemaps;
    expect(fnApplyRemapsToProducts(arrProducts, arrRemaps)).toBe(1);
    expect(arrProducts[0].arrServices[0].nServiceId).toBe(1);
    expect(fnApplyRemapsToConnectionsAbbr(arrConns, arrRemaps)).toBe(1);
    expect(arrConns[0].strServiceAbbr).toBe('FH/KR');
  });
});
