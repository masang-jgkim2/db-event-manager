import {
  fnDefaultServiceId,
  fnEnsureAllProductsServiceIds,
  fnFindServiceByAbbr,
  fnMergeProductServices,
  fnResolveConnectionServiceFields,
  fnResolveConnectionServiceFieldsForWrite,
  fnResolveServiceIdFromAbbr,
  STR_SERVICE_ID_WRITE_REQUIRED,
} from '../utils/serviceId';
import type { IProduct } from '../data/products';

describe('serviceId', () => {
  const arrSample: IProduct[] = [
    {
      nId: 4,
      strName: '아스다글로벌',
      strDescription: '',
      strDbType: 'mssql',
      arrServices: [{ strAbbr: 'AD/G', strRegion: '글로벌' }],
      dtCreatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('fnDefaultServiceId — 프로덕트별 구간', () => {
    expect(fnDefaultServiceId(4, 0)).toBe(4001);
    expect(fnDefaultServiceId(2, 1)).toBe(2002);
  });

  it('fnEnsureAllProductsServiceIds — nServiceId 부여', () => {
    const arr = JSON.parse(JSON.stringify(arrSample)) as IProduct[];
    expect(fnEnsureAllProductsServiceIds(arr)).toBe(true);
    expect(arr[0].arrServices[0].nServiceId).toBe(4001);
  });

  it('fnResolveServiceIdFromAbbr — CC/KR 호환', () => {
    const arr: IProduct[] = [
      {
        nId: 3,
        strName: '콜오브카오스',
        strDescription: '',
        strDbType: 'mssql',
        arrServices: [{ nServiceId: 3001, strAbbr: 'CC/KR', strRegion: '국내' }],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(fnResolveServiceIdFromAbbr(3, 'CC', arr)).toBe(3001);
    expect(fnFindServiceByAbbr(arr[0], 'CC/KR')?.nServiceId).toBe(3001);
  });

  it('fnMergeProductServices — 약자 변경 시 ID 유지', () => {
    const arrExisting = [{ nServiceId: 4001, strAbbr: 'AD/G', strRegion: '글로벌' }];
    const arrMerged = fnMergeProductServices(
      arrExisting,
      [{ nServiceId: 0, strAbbr: 'AD/G', strRegion: '글로벌' }],
      () => 9999,
    );
    expect(arrMerged[0].nServiceId).toBe(4001);
    const arrNew = fnMergeProductServices(
      arrExisting,
      [{ nServiceId: 0, strAbbr: 'AD/EU', strRegion: '유럽' }],
      () => 9999,
    );
    expect(arrNew[0].nServiceId).toBe(9999);
  });

  it('fnResolveConnectionServiceFieldsForWrite — nServiceId 우선', () => {
    const arr: IProduct[] = [
      {
        nId: 3,
        strName: '콜오브카오스',
        strDescription: '',
        strDbType: 'mssql',
        arrServices: [{ nServiceId: 3001, strAbbr: 'CC/KR', strRegion: '국내' }],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const objResolved = fnResolveConnectionServiceFieldsForWrite(arr[0], 3001, 'CC');
    expect('strError' in objResolved).toBe(false);
    if (!('strError' in objResolved)) {
      expect(objResolved.nServiceId).toBe(3001);
      expect(objResolved.strServiceAbbr).toBe('CC/KR');
    }
  });

  it('fnResolveConnectionServiceFieldsForWrite — 약자 단독 거부', () => {
    const objResolved = fnResolveConnectionServiceFieldsForWrite(arrSample[0], null, 'AD/G');
    expect(objResolved).toEqual({ strError: STR_SERVICE_ID_WRITE_REQUIRED });
  });

  it('fnResolveConnectionServiceFields — dual-read 약자 fallback 유지', () => {
    const arr: IProduct[] = [
      {
        nId: 3,
        strName: '콜오브카오스',
        strDescription: '',
        strDbType: 'mssql',
        arrServices: [{ nServiceId: 3001, strAbbr: 'CC/KR', strRegion: '국내' }],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const objRead = fnResolveConnectionServiceFields(arr[0], null, 'CC');
    expect('strError' in objRead).toBe(false);
    if (!('strError' in objRead)) {
      expect(objRead.nServiceId).toBe(3001);
    }
  });
});
