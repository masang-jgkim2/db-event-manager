import { create } from 'zustand';
import type { IProduct } from '../types';

// 프로덕트 관리 스토어
interface IProductStore {
  arrProducts: IProduct[];
  fnAddProduct: (objProduct: Omit<IProduct, 'nId' | 'dtCreatedAt'>) => void;
  fnUpdateProduct: (nId: number, objProduct: Partial<IProduct>) => void;
  fnDeleteProduct: (nId: number) => void;
}

// 임시 로컬 스토어 (추후 API 연동)
export const useProductStore = create<IProductStore>((set) => ({
  arrProducts: [],

  // 프로덕트 추가
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

  // 프로덕트 수정
  fnUpdateProduct: (nId, objProduct) =>
    set((state) => ({
      arrProducts: state.arrProducts.map((p) =>
        p.nId === nId ? { ...p, ...objProduct } : p
      ),
    })),

  // 프로덕트 삭제
  fnDeleteProduct: (nId) =>
    set((state) => ({
      arrProducts: state.arrProducts.filter((p) => p.nId !== nId),
    })),
}));
