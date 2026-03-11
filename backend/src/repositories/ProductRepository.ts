import { IProduct } from '../data/products';
import { arrProducts, fnGetNextProductId } from '../data/products';

// 프로덕트 Repository - 인메모리 구현체
export class ProductRepository {
  async findAll(): Promise<IProduct[]> {
    return [...arrProducts];
  }

  async findById(nId: number): Promise<IProduct | null> {
    return arrProducts.find((p) => p.nId === nId) ?? null;
  }

  async findByName(strName: string): Promise<IProduct | null> {
    return arrProducts.find((p) => p.strName === strName) ?? null;
  }

  async create(objData: Omit<IProduct, 'nId'>): Promise<IProduct> {
    const objNew: IProduct = { nId: fnGetNextProductId(), ...objData };
    arrProducts.push(objNew);
    return objNew;
  }

  async update(nId: number, objData: Partial<IProduct>): Promise<IProduct | null> {
    const nIdx = arrProducts.findIndex((p) => p.nId === nId);
    if (nIdx === -1) return null;
    Object.assign(arrProducts[nIdx], objData);
    return arrProducts[nIdx];
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrProducts.findIndex((p) => p.nId === nId);
    if (nIdx === -1) return false;
    arrProducts.splice(nIdx, 1);
    return true;
  }
}

export const productRepository = new ProductRepository();
