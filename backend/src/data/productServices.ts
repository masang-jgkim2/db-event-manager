// 정규화: 프로덕트별 서비스 (products.arr_services 분리)
import { fnLoadJson, fnSaveJson } from './jsonStore';

export interface IProductServiceRow {
  nId: number;
  nProductId: number;
  strAbbr: string;
  strRegion: string;
}

/** API/타입용 서비스 (strAbbr, strRegion) */
export interface IServiceLike {
  strAbbr: string;
  strRegion: string;
}

const STR_FILE = 'productServices.json';

export const arrProductServices: IProductServiceRow[] = fnLoadJson<IProductServiceRow>(STR_FILE, []);

export const fnSaveProductServices = () => fnSaveJson(STR_FILE, arrProductServices);

export const fnGetNextProductServiceId = (): number =>
  arrProductServices.length > 0 ? Math.max(...arrProductServices.map((s) => s.nId)) + 1 : 1;

/** 해당 프로덕트의 서비스 목록 */
export const fnGetServicesByProductId = (nProductId: number): IServiceLike[] =>
  arrProductServices
    .filter((s) => s.nProductId === nProductId)
    .map((s) => ({ strAbbr: s.strAbbr, strRegion: s.strRegion }));

/** 해당 프로덕트의 서비스를 교체 (기존 삭제 후 새 목록 INSERT) */
export const fnSetServicesForProduct = (nProductId: number, arrServices: IServiceLike[]): void => {
  for (let i = arrProductServices.length - 1; i >= 0; i--) {
    if (arrProductServices[i].nProductId === nProductId) arrProductServices.splice(i, 1);
  }
  let nNext = fnGetNextProductServiceId();
  arrServices.forEach((svc) => {
    arrProductServices.push({
      nId: nNext++,
      nProductId,
      strAbbr: svc.strAbbr,
      strRegion: svc.strRegion,
    });
  });
}
