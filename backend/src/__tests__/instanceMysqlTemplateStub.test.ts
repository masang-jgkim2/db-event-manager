import { fnSanitizeEventTemplateStubForMysqlInsert } from '../db/mysqlRelationalSync';
import type { IEventTemplate } from '../data/events';

const fnMakeTpl = (partial: Partial<IEventTemplate> & { nId: number; nProductId: number }): IEventTemplate => ({
  nId: partial.nId,
  nProductId: partial.nProductId,
  strProductName: partial.strProductName ?? 'P',
  strEventLabel: partial.strEventLabel ?? 'E',
  strDescription: partial.strDescription ?? '',
  strCategory: partial.strCategory ?? 'c',
  strType: partial.strType ?? 't',
  strInputFormat: partial.strInputFormat ?? 'raw',
  strDefaultItems: partial.strDefaultItems ?? '',
  strQueryTemplate: partial.strQueryTemplate ?? '',
  dtCreatedAt: partial.dtCreatedAt ?? '2026-01-01T00:00:00.000Z',
  strCreatedBy: partial.strCreatedBy,
  nCreatedByUserId: partial.nCreatedByUserId,
  strStatus: partial.strStatus ?? 'dba_confirmed',
  arrStatusLogs: partial.arrStatusLogs ?? [],
  objCreator: partial.objCreator ?? null,
  objConfirmer: partial.objConfirmer ?? null,
});

describe('fnSanitizeEventTemplateStubForMysqlInsert', () => {
  it('product 없으면 throw', () => {
    const e = fnMakeTpl({ nId: 60, nProductId: 12, nCreatedByUserId: 1 });
    expect(() =>
      fnSanitizeEventTemplateStubForMysqlInsert(e, new Set([1]), new Set([1])),
    ).toThrow(/product #12 없음/);
  });

  it('없는 creator는 null', () => {
    const e = fnMakeTpl({ nId: 60, nProductId: 1, nCreatedByUserId: 999 });
    const obj = fnSanitizeEventTemplateStubForMysqlInsert(e, new Set([1]), new Set([1]));
    expect(obj.nProductId).toBe(1);
    expect(obj.nCreatedByUserId).toBeNull();
  });

  it('product·creator 모두 유효하면 유지', () => {
    const e = fnMakeTpl({ nId: 60, nProductId: 1, nCreatedByUserId: 7 });
    const obj = fnSanitizeEventTemplateStubForMysqlInsert(e, new Set([1]), new Set([7]));
    expect(obj).toEqual({ nProductId: 1, nCreatedByUserId: 7 });
  });
});
