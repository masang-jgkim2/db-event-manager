import { create } from 'zustand';
import type { IProduct } from '../types';
import { fnApiGetProducts, fnApiCreateProduct, fnApiUpdateProduct, fnApiDeleteProduct } from '../api/productApi';

// 모든 뮤테이션 함수의 반환 타입 — 성공/실패 + 원인 메시지
export interface IStoreResult {
  bSuccess: boolean;
  strMessage: string;
}

interface IProductStore {
  arrProducts: IProduct[];
  bLoading: boolean;
  fnFetchProducts: () => Promise<void>;
  fnAddProduct: (objProduct: Omit<IProduct, 'nId' | 'dtCreatedAt'>) => Promise<IStoreResult>;
  fnUpdateProduct: (nId: number, objProduct: Partial<IProduct>) => Promise<IStoreResult>;
  fnDeleteProduct: (nId: number) => Promise<IStoreResult>;
}

export const useProductStore = create<IProductStore>((set) => ({
  arrProducts: [],
  bLoading: false,

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

  fnAddProduct: async (objProduct) => {
    try {
      const result = await fnApiCreateProduct(objProduct as any);
      if (result.bSuccess) {
        set((state) => ({ arrProducts: [...state.arrProducts, result.objProduct] }));
        return { bSuccess: true, strMessage: '프로덕트가 등록되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '등록에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnUpdateProduct: async (nId, objProduct) => {
    try {
      const result = await fnApiUpdateProduct(nId, objProduct as any);
      if (result.bSuccess) {
        set((state) => ({
          arrProducts: state.arrProducts.map((p) => (p.nId === nId ? result.objProduct : p)),
        }));
        return { bSuccess: true, strMessage: '프로덕트가 수정되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '수정에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  fnDeleteProduct: async (nId) => {
    try {
      const result = await fnApiDeleteProduct(nId);
      if (result.bSuccess) {
        set((state) => ({ arrProducts: state.arrProducts.filter((p) => p.nId !== nId) }));
        return { bSuccess: true, strMessage: '프로덕트가 삭제되었습니다.' };
      }
      return { bSuccess: false, strMessage: result.strMessage || '삭제에 실패했습니다.' };
    } catch (error: any) {
      return { bSuccess: false, strMessage: error?.message || '네트워크 오류가 발생했습니다.' };
    }
  },
}));
