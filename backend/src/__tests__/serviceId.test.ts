import {
  fnEnsureAllProductsServiceIds,
  fnFindServiceByAbbr,
  fnGetNextServiceId,
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
      arrServices: [{ nServiceId: 12, strAbbr: 'AD/G', strRegion: '글로벌' }],
      dtCreatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('fnGetNextServiceId — 전역 MAX+1', () => {
    expect(fnGetNextServiceId(arrSample)).toBe(13);
    const arrEmpty: IProduct[] = [
      {
        nId: 9,
        strName: '신규',
        strDescription: '',
        strDbType: 'mysql',
        arrServices: [{ strAbbr: 'X', strRegion: '국내' }],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(fnGetNextServiceId(arrEmpty)).toBe(1);
  });

  it('fnEnsureAllProductsServiceIds — nServiceId 부여는 MAX+1', () => {
    const arr = JSON.parse(JSON.stringify(arrSample)) as IProduct[];
    arr[0].arrServices = [{ strAbbr: 'AD/G', strRegion: '글로벌' }];
    expect(fnEnsureAllProductsServiceIds(arr)).toBe(true);
    expect(arr[0].arrServices[0].nServiceId).toBe(1);
  });

  it('fnEnsureAllProductsServiceIds — 기존 MAX 다음부터', () => {
    const arr: IProduct[] = [
      {
        nId: 1,
        strName: 'A',
        strDescription: '',
        strDbType: 'mysql',
        arrServices: [{ nServiceId: 12, strAbbr: 'A', strRegion: '국내' }],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        nId: 9,
        strName: 'B',
        strDescription: '',
        strDbType: 'mysql',
        arrServices: [
          { strAbbr: 'B1', strRegion: '국내' },
          { strAbbr: 'B2', strRegion: '해외' },
        ],
        dtCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(fnEnsureAllProductsServiceIds(arr)).toBe(true);
    expect(arr[1].arrServices[0].nServiceId).toBe(13);
    expect(arr[1].arrServices[1].nServiceId).toBe(14);
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

  it('fnMergeProductServices — nServiceId 전달 시 약자 변경해도 ID 유지', () => {
    const arrExisting = [{ nServiceId: 1, strAbbr: 'FH/KR', strRegion: '국내' }];
    const arrMerged = fnMergeProductServices(
      arrExisting,
      // Form hidden 이 문자열로 올 수 있음
      [{ nServiceId: '1' as unknown as number, strAbbr: 'FISH/KR', strRegion: '국내' }],
      () => 19,
    );
    expect(arrMerged[0].nServiceId).toBe(1);
    expect(arrMerged[0].strAbbr).toBe('FISH/KR');
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
