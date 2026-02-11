import { Request, Response } from 'express';
import { arrProducts, fnGetNextProductId } from '../data/products';

// 프로덕트 목록 조회 (모든 인증 사용자)
export const fnGetProducts = async (_req: Request, res: Response): Promise<void> => {
  res.json({ bSuccess: true, arrProducts });
};

// 프로덕트 추가 (관리자)
export const fnCreateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strName, strDescription, strDbType, arrServices } = req.body;

    if (!strName || !strDbType || !arrServices || arrServices.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    const objNew = {
      nId: fnGetNextProductId(),
      strName,
      strDescription: strDescription || '',
      strDbType,
      arrServices,
      dtCreatedAt: new Date().toISOString(),
    };

    arrProducts.push(objNew);
    res.json({ bSuccess: true, objProduct: objNew });
  } catch (error) {
    console.error('프로덕트 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 프로덕트 수정 (관리자)
export const fnUpdateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrProducts.findIndex((p) => p.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '프로덕트를 찾을 수 없습니다.' });
      return;
    }

    const { strName, strDescription, strDbType, arrServices } = req.body;
    if (strName !== undefined) arrProducts[nIndex].strName = strName;
    if (strDescription !== undefined) arrProducts[nIndex].strDescription = strDescription;
    if (strDbType !== undefined) arrProducts[nIndex].strDbType = strDbType;
    if (arrServices !== undefined) arrProducts[nIndex].arrServices = arrServices;

    res.json({ bSuccess: true, objProduct: arrProducts[nIndex] });
  } catch (error) {
    console.error('프로덕트 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 프로덕트 삭제 (관리자)
export const fnDeleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrProducts.findIndex((p) => p.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '프로덕트를 찾을 수 없습니다.' });
      return;
    }

    arrProducts.splice(nIndex, 1);
    res.json({ bSuccess: true, strMessage: '프로덕트가 삭제되었습니다.' });
  } catch (error) {
    console.error('프로덕트 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
