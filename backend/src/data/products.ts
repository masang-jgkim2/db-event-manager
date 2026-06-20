import { fnLoadJson, fnSaveJson, fnReadJsonArrayFromDisk } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnEnsureAllProductsServiceIds } from '../utils/serviceId';

// 프로덕트 데이터 저장소

export interface IService {
  /** 불변 식별자 — backfill·생성 후 필수 (product_service.n_id) */
  nServiceId?: number;
  strAbbr: string;
  strRegion: string;
}

/** 서비스 목록·영속화는 전부 `arrServices` → `products.json` 한 곳 (별도 정규화 JSON 없음) */
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
    arrServices: [{ nServiceId: 1001, strAbbr: 'FH/KR', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 2,
    strName: 'DK온라인',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [
      { nServiceId: 2001, strAbbr: 'DK/KR', strRegion: '국내' },
      { nServiceId: 2002, strAbbr: 'DK/G', strRegion: '스팀' },
    ],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 3,
    strName: '콜오브카오스',
    strDescription: '전략 게임',
    strDbType: 'mysql',
    arrServices: [{ nServiceId: 3001, strAbbr: 'CC/KR', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 4,
    strName: '아스다스토리',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [{ nServiceId: 4001, strAbbr: 'AD/G', strRegion: '글로벌' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 5,
    strName: '에이스온라인',
    strDescription: '비행 슈팅 MMORPG',
    strDbType: 'mysql',
    arrServices: [
      { nServiceId: 5001, strAbbr: 'AO/KR', strRegion: '국내' },
      { nServiceId: 5002, strAbbr: 'AO/EU', strRegion: '유럽' },
      { nServiceId: 5003, strAbbr: 'AO/JP', strRegion: '일본' },
    ],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 6,
    strName: '라그하임',
    strDescription: 'MMORPG',
    strDbType: 'mysql',
    arrServices: [{ nServiceId: 6001, strAbbr: 'LH/KR', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
  {
    nId: 7,
    strName: '스키드러시',
    strDescription: '레이싱 게임',
    strDbType: 'mysql',
    arrServices: [{ nServiceId: 7001, strAbbr: 'SR', strRegion: '국내' }],
    dtCreatedAt: new Date().toISOString(),
  },
];

export const arrProducts: IProduct[] = fnLoadJson<IProduct>(STR_FILE, ARR_SEED);
if (fnEnsureAllProductsServiceIds(arrProducts)) {
  fnSaveJson(STR_FILE, arrProducts);
  console.log('[products] arrServices nServiceId backfill | products.json 저장');
}

/** 메모리가 비어 있고 디스크에 건수가 있으면 products.json에서 다시 채움 */
export const fnReloadProductsFromDiskIfEmpty = (): boolean => {
  if (arrProducts.length > 0) return false;
  if (fnIsMysqlStore()) return false;
  const arrRaw = fnReadJsonArrayFromDisk<IProduct>(STR_FILE);
  if (!arrRaw?.length) return false;
  arrProducts.length = 0;
  arrProducts.push(...arrRaw);
  console.log(`[products] 메모리 비어 ${STR_FILE}에서 ${arrRaw.length}건 재로드`);
  return true;
};

export const fnSaveProducts = () => fnSaveJson(STR_FILE, arrProducts);

export const fnGetNextProductId = (): number =>
  arrProducts.length > 0 ? Math.max(...arrProducts.map((p) => p.nId)) + 1 : 1;

export const fnNormalizeProductName = (strName: string | undefined): string =>
  (strName ?? '').trim();

export const fnFindProductByName = (
  strName: string,
  nExcludeId?: number,
): IProduct | undefined => {
  const strNorm = fnNormalizeProductName(strName);
  if (!strNorm) return undefined;
  return arrProducts.find(
    (p) => p.nId !== nExcludeId && fnNormalizeProductName(p.strName) === strNorm,
  );
};
