import { fnGetStoreBackend } from '../persistence/storeBackend';
import { fnLoadJson, fnSaveJson } from './jsonStore';

// 프로덕트 데이터 저장소

export interface IService {
  strAbbr: string;
  strRegion: string;
}

export interface IProduct {
  nId: number;
  strName: string;
  strDescription: string;
  strDbType: string;
  arrServices: IService[];
  dtCreatedAt: string;
}

const STR_FILE = 'products.json';

// 시드 데이터 (최초 실행 시에만 사용)
const ARR_SEED: IProduct[] = [
  {
    nId: 1,
    strName: '출조낚시왕',
    strDescription: '낚시 게임',
    strDbType: 'mysql',
    arrServices: [{ strAbbr: 'FH', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 2,
    strName: 'DK온라인',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [
      { strAbbr: 'DK/KR', strRegion: '국내' },
      { strAbbr: 'DK/G', strRegion: '스팀' },
    ],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 3,
    strName: '콜오브카오스',
    strDescription: '전략 게임',
    strDbType: 'mysql',
    arrServices: [{ strAbbr: 'CC', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 4,
    strName: '아스다스토리',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [{ strAbbr: 'AD/G', strRegion: '글로벌' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 5,
    strName: '에이스온라인',
    strDescription: '비행 슈팅 MMORPG',
    strDbType: 'mysql',
    arrServices: [
      { strAbbr: 'AO/KR', strRegion: '국내' },
      { strAbbr: 'AO/EU', strRegion: '유럽' },
      { strAbbr: 'AO/JP', strRegion: '일본' },
    ],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 6,
    strName: '라그하임',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [{ strAbbr: 'LH', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 7,
    strName: '스키드러시',
    strDescription: '레이싱 게임',
    strDbType: 'mysql',
    arrServices: [{ strAbbr: 'SR', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
];

export const arrProducts: IProduct[] = fnLoadJson<IProduct>(STR_FILE, ARR_SEED);

export const fnSaveProducts = async (): Promise<void> => {
  if (fnGetStoreBackend() === 'rdb') {
    const { fnFlushProductCatalogToRdb } = await import('../persistence/rdb/catalogPersistHelper');
    await fnFlushProductCatalogToRdb();
    return;
  }
  fnSaveJson(STR_FILE, arrProducts);
};

export const fnGetNextProductId = (): number =>
  arrProducts.length > 0 ? Math.max(...arrProducts.map((p) => p.nId)) + 1 : 1;
