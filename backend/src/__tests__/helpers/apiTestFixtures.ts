import request from 'supertest';
import type { Express } from 'express';
import { arrProducts, fnCommitProductsToStore } from '../../data/products';
import { arrEvents, fnIsTemplateReadyForInstance } from '../../data/events';
import type { IProduct } from '../../data/products';

/** API 테스트용 고유 이름 — 디스크 중복·409 방지 */
export const fnUniqueApiTestName = (strPrefix: string): string =>
  `${strPrefix}_${Date.now().toString(36)}`;

/** admin 로그인 토큰 — describe 단독 실행 시 beforeAll 보완용 */
export const fnLoginAdminToken = async (app: Express): Promise<string> => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ strUserId: 'admin', strPassword: 'admin123' });
  if (res.status !== 200 || !res.body.strToken) {
    throw new Error(`admin 로그인 실패 | status=${res.status}`);
  }
  return res.body.strToken as string;
};

/** Jest 반복 실행 시 쌓인 임시 프로덕트 정리 */
export const fnPruneEphemeralTestProducts = async (): Promise<number> => {
  const nBefore = arrProducts.length;
  for (let i = arrProducts.length - 1; i >= 0; i--) {
    const strName = arrProducts[i].strName;
    if (strName === '테스트프로덕트' || strName.startsWith('테스트프로덕트_')) {
      arrProducts.splice(i, 1);
    }
  }
  if (arrProducts.length !== nBefore) await fnCommitProductsToStore();
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

/** 쿼리 템플릿 DBA 승인 완료까지 상태 전이 */
export const fnApiPatchTemplateDbaConfirmed = async (
  app: Express,
  strToken: string,
  nTemplateId: number,
): Promise<void> => {
  const resReq = await request(app)
    .patch(`/api/events/${nTemplateId}/status`)
    .set('Authorization', `Bearer ${strToken}`)
    .send({ strNextStatus: 'confirm_requested' });
  if (resReq.status !== 200) {
    throw new Error(`confirm_requested 실패 | status=${resReq.status} ${resReq.body?.strMessage ?? ''}`);
  }
  const resConf = await request(app)
    .patch(`/api/events/${nTemplateId}/status`)
    .set('Authorization', `Bearer ${strToken}`)
    .send({ strNextStatus: 'dba_confirmed' });
  if (resConf.status !== 200) {
    throw new Error(`dba_confirmed 실패 | status=${resConf.status} ${resConf.body?.strMessage ?? ''}`);
  }
};
