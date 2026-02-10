import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IProduct } from '../types';

interface IProductStore {
  arrProducts: IProduct[];
  fnSetProducts: (arrProducts: IProduct[]) => void;
  fnAddProduct: (objProduct: Omit<IProduct, 'nId' | 'dtCreatedAt'>) => void;
  fnUpdateProduct: (nId: number, objProduct: Partial<IProduct>) => void;
  fnDeleteProduct: (nId: number) => void;
}

// 실제 프로덕트 시드 데이터 (7개 게임)
const arrSeedProducts: IProduct[] = [
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

export const useProductStore = create<IProductStore>()(
  persist(
    (set) => ({
      arrProducts: arrSeedProducts,

      fnSetProducts: (arrProducts) => set({ arrProducts }),

      fnAddProduct: (objProduct) =>
        set((state) => ({
          arrProducts: [
            ...state.arrProducts,
            {
              ...objProduct,
              nId: Date.now(),
              dtCreatedAt: new Date().toISOString(),
            },
          ],
        })),

      fnUpdateProduct: (nId, objProduct) =>
        set((state) => ({
          arrProducts: state.arrProducts.map((p) =>
            p.nId === nId ? { ...p, ...objProduct } : p
          ),
        })),

      fnDeleteProduct: (nId) =>
        set((state) => ({
          arrProducts: state.arrProducts.filter((p) => p.nId !== nId),
        })),
    }),
    {
      name: 'em-products', // localStorage 키
      version: 2,          // 버전 변경 시 localStorage 초기화
    }
  )
);
