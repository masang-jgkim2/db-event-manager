import type { IProduct, IService } from '../data/products';
import type { IEventInstance } from '../data/eventInstances';
import type { IDbConnection } from '../types';
import { fnNormalizeServiceAbbr, fnServiceAbbrsCompatible } from './serviceScope';

/** 약자 변경으로 잘못 재발급된 서비스 ID 복구 대상 프로덕트 */
export const ARR_REPAIR_PRODUCT_NAMES = [
  '출조낚시왕',
  '콜오브카오스',
  '스키드러시',
  '라그하임',
] as const;

export type TServiceIdRemap = {
  nProductId: number;
  strProductName: string;
  /** 잘못 발급된 현재 product_service.n_id */
  nFromId: number;
  /** DB 접속·인스턴스가 참조하는 기존 ID */
  nToId: number;
  strAbbr: string;
  strRegion: string;
  nConnRefs: number;
  nInstRefs: number;
};

export type TRemapPlanResult = {
  arrRemaps: TServiceIdRemap[];
  arrSkipped: string[];
  arrErrors: string[];
};

const fnCollectIds = (arr: Array<number | null | undefined>): Set<number> => {
  const set = new Set<number>();
  for (const n of arr) {
    const nId = Number(n);
    if (nId > 0) set.add(nId);
  }
  return set;
};

const fnAbbrMatchesService = (strRefAbbr: string | undefined | null, objSvc: IService): boolean => {
  const strNorm = fnNormalizeServiceAbbr(strRefAbbr);
  if (!strNorm) return true;
  return fnServiceAbbrsCompatible(strNorm, objSvc.strAbbr);
};

/**
 * product.arrServices ID가 재발급되어, 접속·인스턴스가 옛 ID를 가리키는 경우 remap 계획.
 * ID는 환경마다 다를 수 있어 하드코딩하지 않고 참조 관계로 추론한다.
 */
export const fnPlanReissuedServiceIdRemaps = (
  arrProducts: readonly IProduct[],
  arrConnections: readonly IDbConnection[],
  arrInstances: readonly IEventInstance[],
  arrTargetNames: readonly string[] = ARR_REPAIR_PRODUCT_NAMES,
): TRemapPlanResult => {
  const arrRemaps: TServiceIdRemap[] = [];
  const arrSkipped: string[] = [];
  const arrErrors: string[] = [];
  const setAllServiceIds = fnCollectIds(
    arrProducts.flatMap((p) => (p.arrServices ?? []).map((s) => s.nServiceId)),
  );

  for (const strName of arrTargetNames) {
    const objProd = arrProducts.find((p) => p.strName === strName);
    if (!objProd) {
      arrSkipped.push(`${strName}: 프로덕트 없음`);
      continue;
    }
    const arrServices = objProd.arrServices ?? [];
    if (arrServices.length === 0) {
      arrSkipped.push(`${strName}: 서비스 구분 없음`);
      continue;
    }

    const setProductIds = fnCollectIds(arrServices.map((s) => s.nServiceId));
    const arrProdConns = arrConnections.filter((c) => c.nProductId === objProd.nId);
    const arrProdInst = arrInstances.filter((i) => i.nProductId === objProd.nId);

    for (const objSvc of arrServices) {
      const nFromId = Number(objSvc.nServiceId);
      if (!(nFromId > 0)) {
        arrErrors.push(`${strName} / ${objSvc.strAbbr}: nServiceId 없음`);
        continue;
      }

      const arrOrphanConnIds = [
        ...new Set(
          arrProdConns
            .filter((c) => {
              const nId = Number(c.nServiceId);
              if (!(nId > 0) || setProductIds.has(nId)) return false;
              return fnAbbrMatchesService(c.strServiceAbbr, objSvc);
            })
            .map((c) => Number(c.nServiceId)),
        ),
      ];
      const arrOrphanInstIds = [
        ...new Set(
          arrProdInst
            .filter((i) => {
              const nId = Number(i.nServiceId);
              if (!(nId > 0) || setProductIds.has(nId)) return false;
              return fnAbbrMatchesService(i.strServiceAbbr, objSvc);
            })
            .map((i) => Number(i.nServiceId)),
        ),
      ];
      const setOrphan = new Set([...arrOrphanConnIds, ...arrOrphanInstIds]);

      if (setOrphan.size === 0) {
        const nConnOk = arrProdConns.filter((c) => Number(c.nServiceId) === nFromId).length;
        const nInstOk = arrProdInst.filter((i) => Number(i.nServiceId) === nFromId).length;
        if (nConnOk + nInstOk > 0 || arrProdConns.every((c) => !(Number(c.nServiceId) > 0))) {
          arrSkipped.push(`${strName} / ${objSvc.strAbbr}(#${nFromId}): 불일치 없음`);
        } else {
          arrSkipped.push(
            `${strName} / ${objSvc.strAbbr}(#${nFromId}): 참조 orphan ID 없음(수동 확인)`,
          );
        }
        continue;
      }
      if (setOrphan.size > 1) {
        arrErrors.push(
          `${strName} / ${objSvc.strAbbr}(#${nFromId}): orphan ID 다수 [${[...setOrphan].join(',')}]`,
        );
        continue;
      }

      const nToId = [...setOrphan][0];
      if (nToId === nFromId) {
        arrSkipped.push(`${strName} / ${objSvc.strAbbr}: 이미 일치`);
        continue;
      }
      // 다른 프로덕트 서비스가 이미 nToId를 쓰면 PK 충돌
      if (setAllServiceIds.has(nToId) && !setProductIds.has(nToId)) {
        arrErrors.push(
          `${strName} / ${objSvc.strAbbr}: 복구 ID #${nToId}가 다른 프로덕트 서비스에 이미 존재`,
        );
        continue;
      }
      if (setProductIds.has(nToId) && nToId !== nFromId) {
        arrErrors.push(
          `${strName} / ${objSvc.strAbbr}: 복구 ID #${nToId}가 이 프로덕트 다른 서비스와 충돌`,
        );
        continue;
      }

      arrRemaps.push({
        nProductId: objProd.nId,
        strProductName: objProd.strName,
        nFromId,
        nToId,
        strAbbr: objSvc.strAbbr,
        strRegion: objSvc.strRegion,
        nConnRefs: arrProdConns.filter((c) => Number(c.nServiceId) === nToId).length,
        nInstRefs: arrProdInst.filter((i) => Number(i.nServiceId) === nToId).length,
      });
    }
  }

  return { arrRemaps, arrSkipped, arrErrors };
};

/** 메모리 products에 remap 적용 */
export const fnApplyRemapsToProducts = (
  arrProducts: IProduct[],
  arrRemaps: readonly TServiceIdRemap[],
): number => {
  let n = 0;
  for (const objRemap of arrRemaps) {
    const objProd = arrProducts.find((p) => p.nId === objRemap.nProductId);
    if (!objProd) continue;
    const objSvc = objProd.arrServices.find((s) => Number(s.nServiceId) === objRemap.nFromId);
    if (!objSvc) continue;
    objSvc.nServiceId = objRemap.nToId;
    n += 1;
  }
  return n;
};

/** 접속 행 약자를 프로덕트 현재 약자로 맞춤 (nServiceId=복구 ID) */
export const fnApplyRemapsToConnectionsAbbr = (
  arrConnections: IDbConnection[],
  arrRemaps: readonly TServiceIdRemap[],
): number => {
  let n = 0;
  for (const objRemap of arrRemaps) {
    for (const objConn of arrConnections) {
      if (objConn.nProductId !== objRemap.nProductId) continue;
      if (Number(objConn.nServiceId) !== objRemap.nToId) continue;
      if (fnNormalizeServiceAbbr(objConn.strServiceAbbr) === objRemap.strAbbr) continue;
      objConn.strServiceAbbr = objRemap.strAbbr;
      n += 1;
    }
  }
  return n;
};
