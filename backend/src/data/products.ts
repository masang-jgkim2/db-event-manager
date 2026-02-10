// 프로덕트 데이터 저장소 (추후 DB 연동 시 교체)

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

// 시드 데이터 (7개 게임)
export const arrProducts: IProduct[] = [
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

// 다음 ID
export const fnGetNextProductId = (): number => {
  return arrProducts.length > 0 ? Math.max(...arrProducts.map((p) => p.nId)) + 1 : 1;
};
