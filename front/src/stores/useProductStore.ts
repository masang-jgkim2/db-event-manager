import { create } from 'zustand';
import type { IProduct } from '../types';
import { fnApiGetProducts, fnApiCreateProduct, fnApiUpdateProduct, fnApiDeleteProduct } from '../api/productApi';

interface IProductStore {
  arrProducts: IProduct[];
  bLoading: boolean;
  fnFetchProducts: () => Promise<void>;
  fnAddProduct: (objProduct: Omit<IProduct, 'nId' | 'dtCreatedAt'>) => Promise<boolean>;
  fnUpdateProduct: (nId: number, objProduct: Partial<IProduct>) => Promise<boolean>;
  fnDeleteProduct: (nId: number) => Promise<boolean>;
}

export const useProductStore = create<IProductStore>((set) => ({
  arrProducts: [],
  bLoading: false,

  // 서버에서 프로덕트 목록 로드
  fnFetchProducts: async () => {
    set({ bLoading: true });
    try {
      const result = await fnApiGetProducts();
      if (result.bSuccess) {
        set({ arrProducts: result.arrProducts });
      }
    } catch {
      console.error('프로덕트 목록 조회 실패');
    } finally {
      set({ bLoading: false });
    }
  },

  // 프로덕트 추가
  fnAddProduct: async (objProduct) => {
    try {
      const result = await fnApiCreateProduct(objProduct as any);
      if (result.bSuccess) {
        set((state) => ({ arrProducts: [...state.arrProducts, result.objProduct] }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // 프로덕트 수정
  fnUpdateProduct: async (nId, objProduct) => {
    try {
      const result = await fnApiUpdateProduct(nId, objProduct as any);
      if (result.bSuccess) {
        set((state) => ({
          arrProducts: state.arrProducts.map((p) => (p.nId === nId ? result.objProduct : p)),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // 프로덕트 삭제
  fnDeleteProduct: async (nId) => {
    try {
      const result = await fnApiDeleteProduct(nId);
      if (result.bSuccess) {
        set((state) => ({ arrProducts: state.arrProducts.filter((p) => p.nId !== nId) }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
