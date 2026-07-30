import type { IProduct, IService } from '../data/products';
import { fnServiceAbbrsCompatible } from './serviceScope';

/** backfill·신규 서비스 기본 ID: nProductId*1000 + (sort+1) — 프로덕트별 구간 분리 */
export const fnDefaultServiceId = (nProductId: number, nSort: number): number =>
  nProductId * 1000 + (nSort + 1);

export const fnGetMaxServiceId = (arrProducts: readonly IProduct[]): number => {
  let nMax = 0;
  for (const objProd of arrProducts) {
    for (const objSvc of objProd.arrServices ?? []) {
      const nId = Number(objSvc.nServiceId);
      if (nId > nMax) nMax = nId;
    }
  }
  return nMax;
};

export const fnGetNextServiceId = (arrProducts: readonly IProduct[]): number =>
  fnGetMaxServiceId(arrProducts) + 1;

/** arrServices에 nServiceId 없으면 할당 (기존 ID 유지) */
export const fnEnsureProductServiceIds = (objProduct: IProduct): boolean => {
  let bChanged = false;
  objProduct.arrServices = (objProduct.arrServices ?? []).map((objSvc, nSort) => {
    const nExisting = Number(objSvc.nServiceId);
    if (nExisting > 0) return objSvc;
    bChanged = true;
    return { ...objSvc, nServiceId: fnDefaultServiceId(objProduct.nId, nSort) };
  });
  return bChanged;
};

export const fnEnsureAllProductsServiceIds = (arrProducts: IProduct[]): boolean => {
  let bAny = false;
  let nNext = fnGetMaxServiceId(arrProducts) + 1;
  for (const objProd of arrProducts) {
    if (fnEnsureProductServiceIds(objProd)) {
      bAny = true;
    }
    const setSeen = new Set<number>();
    for (const objSvc of objProd.arrServices) {
      const nId = Number(objSvc.nServiceId);
      if (nId > 0 && !setSeen.has(nId)) {
        setSeen.add(nId);
        continue;
      }
      objSvc.nServiceId = nNext++;
      bAny = true;
    }
  }
  return bAny;
};

export const fnFindServiceById = (
  objProduct: Pick<IProduct, 'arrServices'> | undefined,
  nServiceId: number,
): IService | undefined =>
  objProduct?.arrServices?.find((s) => s.nServiceId != null && s.nServiceId === nServiceId);

export const fnFindServiceByAbbr = (
  objProduct: Pick<IProduct, 'arrServices'> | undefined,
  strAbbr: string,
): IService | undefined => {
  const strNorm = (strAbbr ?? '').trim();
  if (!objProduct?.arrServices?.length || !strNorm) return undefined;
  const objExact = objProduct.arrServices.find((s) => s.strAbbr === strNorm);
  if (objExact) return objExact;
  return objProduct.arrServices.find((s) => fnServiceAbbrsCompatible(s.strAbbr, strNorm));
};

/** 프로덕트 수정 시 서비스 ID 유지·신규 할당 (약자 변경만이면 ID 유지) */
export const fnMergeProductServices = (
  arrExisting: IService[],
  arrIncoming: IService[],
  fnNextId: () => number,
): IService[] =>
  arrIncoming.map((objIn) => {
    // Form hidden 등으로 문자열이 올 수 있음
    const nInId = Number(objIn.nServiceId);
    if (nInId > 0) {
      const objById = arrExisting.find((s) => Number(s.nServiceId) === nInId);
      if (objById) {
        return {
          nServiceId: objById.nServiceId,
          strAbbr: objIn.strAbbr,
          strRegion: objIn.strRegion,
        };
      }
    }
    const objByAbbr = arrExisting.find((s) => s.strAbbr === objIn.strAbbr);
    if (objByAbbr?.nServiceId) {
      return {
        nServiceId: objByAbbr.nServiceId,
        strAbbr: objIn.strAbbr,
        strRegion: objIn.strRegion,
      };
    }
    return {
      strAbbr: objIn.strAbbr,
      strRegion: objIn.strRegion,
      nServiceId: fnNextId(),
    };
  });

/** backfill: strServiceAbbr → nServiceId (없으면 undefined) */
export const fnResolveServiceIdFromAbbr = (
  nProductId: number,
  strAbbr: string | undefined | null,
  arrProducts: readonly IProduct[],
): number | undefined => {
  const strNorm = (strAbbr ?? '').trim();
  if (!strNorm) return undefined;
  const objProd = arrProducts.find((p) => p.nId === nProductId);
  return fnFindServiceByAbbr(objProd, strNorm)?.nServiceId;
};

export type TResolvedConnectionService = {
  nServiceId?: number;
  strServiceAbbr?: string;
};

/** 등록·생성 API — 약자 단독(strServiceAbbr only) 거부, nServiceId 또는 공통(둘 다 비움)만 허용 */
export const STR_SERVICE_ID_WRITE_REQUIRED =
  '서비스 구분은 nServiceId로 지정해주세요. (약자 strServiceAbbr 단독 등록·생성은 지원하지 않습니다)';

export const fnResolveConnectionServiceFieldsForWrite = (
  objProduct: Pick<IProduct, 'strName' | 'arrServices'> | undefined,
  nServiceId?: number | null,
  strServiceAbbr?: string | null,
): TResolvedConnectionService | { strError: string } => {
  const nId = Number(nServiceId);
  if (nId > 0) {
    return fnResolveConnectionServiceFields(objProduct, nServiceId, null);
  }
  if ((strServiceAbbr ?? '').trim()) {
    return { strError: STR_SERVICE_ID_WRITE_REQUIRED };
  }
  return {};
};

/** DB 접속·이벤트 생성 — nServiceId 우선, 없으면 strServiceAbbr로 해석 (실행·레거시 dual-read) */
export const fnResolveConnectionServiceFields = (
  objProduct: Pick<IProduct, 'strName' | 'arrServices'> | undefined,
  nServiceId?: number | null,
  strServiceAbbr?: string | null,
): TResolvedConnectionService | { strError: string } => {
  if (!objProduct) return {};

  const nId = Number(nServiceId);
  if (nId > 0) {
    const objSvc = fnFindServiceById(objProduct, nId);
    if (!objSvc?.nServiceId) {
      return {
        strError: `서비스 ID #${nId}는 프로덕트「${objProduct.strName}」에 등록되지 않았습니다.`,
      };
    }
    return { nServiceId: objSvc.nServiceId, strServiceAbbr: objSvc.strAbbr };
  }

  const strNorm = (strServiceAbbr ?? '').trim();
  if (!strNorm) return {};

  const objByAbbr = fnFindServiceByAbbr(objProduct, strNorm);
  if (!objByAbbr) {
    return {
      strError: `국가/플랫폼「${strNorm}」는 프로덕트「${objProduct.strName}」에 등록되지 않았습니다.`,
    };
  }
  return {
    nServiceId: objByAbbr.nServiceId,
    strServiceAbbr: objByAbbr.strAbbr,
  };
};
