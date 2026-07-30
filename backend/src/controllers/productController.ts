import { Request, Response } from 'express';
import { arrProducts, fnFindProductByName, fnGetNextProductId, fnCommitProductsToStore, fnReloadProductsFromDiskIfEmpty } from '../data/products';
import { fnEnsureAllProductsServiceIds, fnEnsureProductServiceIds, fnGetNextServiceId, fnMergeProductServices } from '../utils/serviceId';
import {
  fnCascadeProductDisplayName,
  fnCascadeProductServiceAbbr,
} from '../services/productNameCascade';

const fnIsProductPersistConflict = (strMessage: string): boolean =>
  strMessage.includes('사용 중') || strMessage.includes('삭제할 수 없습니다');

export const fnGetProducts = async (_req: Request, res: Response): Promise<void> => {
  fnReloadProductsFromDiskIfEmpty();
  res.json({ bSuccess: true, arrProducts });
};

export const fnCreateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strName, strDescription, strDbType, arrServices } = req.body;

    if (!strName || !strDbType || !arrServices || arrServices.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    const objDup = fnFindProductByName(strName);
    if (objDup) {
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage: `프로덕트명 "${objDup.strName}"(ID #${objDup.nId})이(가) 이미 등록되어 있습니다.`,
        objExistingProduct: objDup,
      });
      return;
    }

    const objNew = {
      nId: fnGetNextProductId(), strName,
      strDescription: strDescription || '', strDbType,
      arrServices: [] as typeof arrServices,
      dtCreatedAt: new Date().toISOString(),
    };
    objNew.arrServices = (arrServices as Array<{ strAbbr: string; strRegion: string; nServiceId?: number }>).map(
      (objSvc) => ({
        strAbbr: objSvc.strAbbr,
        strRegion: objSvc.strRegion,
        nServiceId: 0,
      }),
    );
    fnEnsureProductServiceIds(objNew);

    arrProducts.push(objNew);
    try {
      await fnCommitProductsToStore();
    } catch (errPersist: unknown) {
      arrProducts.pop();
      console.error('[products] MySQL 반영 실패 |', errPersist);
      res.status(500).json({
        bSuccess: false,
        strMessage: (errPersist as Error)?.message ?? '프로덕트 저장에 실패했습니다.',
      });
      return;
    }
    res.json({ bSuccess: true, objProduct: objNew });
  } catch (error) {
    console.error('프로덕트 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

export const fnUpdateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const nIndex = arrProducts.findIndex((p) => p.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '프로덕트를 찾을 수 없습니다.' });
      return;
    }

    const { strName, strDescription, strDbType, arrServices } = req.body;

    if (strName !== undefined) {
      const objDup = fnFindProductByName(strName, nId);
      if (objDup) {
        res.status(409).json({
          bSuccess: false,
          strErrorCode: 'DUPLICATE',
          strMessage: `프로덕트명 "${objDup.strName}"(ID #${objDup.nId})이(가) 이미 등록되어 있습니다.`,
          objExistingProduct: objDup,
        });
        return;
      }
      arrProducts[nIndex].strName = strName;
    }
    if (strDescription !== undefined) arrProducts[nIndex].strDescription = strDescription;
    if (strDbType      !== undefined) arrProducts[nIndex].strDbType      = strDbType;
    const arrServicesBefore =
      arrServices !== undefined ? [...arrProducts[nIndex].arrServices] : [];
    if (arrServices !== undefined) {
      arrProducts[nIndex].arrServices = fnMergeProductServices(
        arrProducts[nIndex].arrServices,
        arrServices,
        () => fnGetNextServiceId(arrProducts),
      );
    }

    try {
      await fnCommitProductsToStore();
    } catch (errPersist: unknown) {
      console.error('[products] MySQL 반영 실패 |', errPersist);
      res.status(500).json({
        bSuccess: false,
        strMessage: (errPersist as Error)?.message ?? '프로덕트 저장에 실패했습니다.',
      });
      return;
    }

    const strCurrentName = arrProducts[nIndex].strName;
    try {
      await fnCascadeProductDisplayName(nId, strCurrentName);
    } catch (err: unknown) {
      console.error('[products] 프로덕트명 연쇄 반영 실패 |', (err as Error)?.message ?? err);
    }
    if (arrServices !== undefined) {
      try {
        await fnCascadeProductServiceAbbr(
          nId,
          arrServicesBefore,
          arrProducts[nIndex].arrServices,
        );
      } catch (err: unknown) {
        console.error('[products] 서비스 약자 연쇄 반영 실패 |', (err as Error)?.message ?? err);
      }
    }

    res.json({ bSuccess: true, objProduct: arrProducts[nIndex] });
  } catch (error) {
    console.error('프로덕트 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

export const fnDeleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const nIndex = arrProducts.findIndex((p) => p.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '프로덕트를 찾을 수 없습니다.' });
      return;
    }

    const objRemoved = arrProducts[nIndex];
    arrProducts.splice(nIndex, 1);
    try {
      await fnCommitProductsToStore();
    } catch (errPersist: unknown) {
      arrProducts.splice(nIndex, 0, objRemoved);
      const strMessage = (errPersist as Error)?.message ?? '프로덕트 삭제에 실패했습니다.';
      console.error('[products] MySQL 삭제 실패 |', strMessage);
      res.status(fnIsProductPersistConflict(strMessage) ? 409 : 500).json({
        bSuccess: false,
        strMessage,
      });
      return;
    }
    res.json({ bSuccess: true, strMessage: '프로덕트가 삭제되었습니다.' });
  } catch (error) {
    console.error('프로덕트 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
