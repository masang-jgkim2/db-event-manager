import { arrProducts, fnSaveProducts } from '../../data/products';
import { arrEvents, fnIsTemplateReadyForInstance } from '../../data/events';
import type { IProduct } from '../../data/products';

/** API 테스트용 고유 이름 — 디스크 중복·409 방지 */
export const fnUniqueApiTestName = (strPrefix: string): string =>
  `${strPrefix}_${Date.now().toString(36)}`;

/** Jest 반복 실행 시 쌓인 임시 프로덕트 정리 */
export const fnPruneEphemeralTestProducts = (): number => {
  const nBefore = arrProducts.length;
  for (let i = arrProducts.length - 1; i >= 0; i--) {
    const strName = arrProducts[i].strName;
    if (strName === '테스트프로덕트' || strName.startsWith('테스트프로덕트_')) {
      arrProducts.splice(i, 1);
    }
  }
  if (arrProducts.length !== nBefore) fnSaveProducts();
  return nBefore - arrProducts.length;
};

export const fnFindProductById = (nProductId: number): IProduct | undefined =>
  arrProducts.find((p) => p.nId === nProductId);

/** 프로덕트 첫 서비스 약자 — DB 접속 strServiceAbbr와 맞춤 */
export const fnPrimaryServiceAbbr = (nProductId: number): string =>
  fnFindProductById(nProductId)?.arrServices?.[0]?.strAbbr?.trim() ?? '';

/** DBA 승인 완료 템플릿 — 없으면 undefined */
export const fnFindReadyTemplateForProduct = (nProductId: number) =>
  arrEvents.find((e) => e.nProductId === nProductId && fnIsTemplateReadyForInstance(e));
