import { Request, Response } from 'express';
import { arrEvents, fnGetNextEventId, fnSaveEvents } from '../data/events';
import { arrProducts } from '../data/products';

// 쿼리 템플릿 목록 조회 (모든 인증 사용자)
export const fnGetEvents = async (_req: Request, res: Response): Promise<void> => {
  res.json({ bSuccess: true, arrEvents });
};

// 쿼리 템플릿 추가 (관리자)
export const fnCreateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nProductId, strEventLabel, strDescription,
      strCategory, strType, strInputFormat,
      strDefaultItems, strQueryTemplate, arrQueryTemplates,
    } = req.body;

    if (!nProductId || !strEventLabel || !strCategory || !strType || !strInputFormat) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    // 프로덕트명 조회
    const objProduct = arrProducts.find((p) => p.nId === nProductId);

    const objNew = {
      nId: fnGetNextEventId(),
      nProductId,
      strProductName: objProduct?.strName || '',
      strEventLabel,
      strDescription: strDescription || '',
      strCategory,
      strType,
      strInputFormat,
      strDefaultItems: strDefaultItems || '',
      strQueryTemplate: strQueryTemplate || '',
      arrQueryTemplates: Array.isArray(arrQueryTemplates) ? arrQueryTemplates : undefined,
      dtCreatedAt: new Date().toISOString(),
    };

    arrEvents.push(objNew);
    fnSaveEvents();
    res.json({ bSuccess: true, objEvent: objNew });
  } catch (error) {
    console.error('쿼리 템플릿 추가 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 쿼리 템플릿 수정 (관리자)
export const fnUpdateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrEvents.findIndex((e) => e.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '쿼리 템플릿을 찾을 수 없습니다.' });
      return;
    }

    const fields = [
      'nProductId', 'strEventLabel', 'strDescription',
      'strCategory', 'strType', 'strInputFormat',
      'strDefaultItems', 'strQueryTemplate', 'arrQueryTemplates',
    ];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        (arrEvents[nIndex] as any)[key] = req.body[key];
      }
    }

    // 단일 쿼리 모드일 때만 세트 비움: strQueryTemplate을 보냈고, arrQueryTemplates를 안 보냈거나 비어 있을 때
    const bSingleMode = req.body.strQueryTemplate !== undefined
      && (!Array.isArray(req.body.arrQueryTemplates) || req.body.arrQueryTemplates.length === 0);
    if (bSingleMode) {
      (arrEvents[nIndex] as any).arrQueryTemplates = undefined;
    }

    // 프로덕트명 갱신
    if (req.body.nProductId !== undefined) {
      const objProduct = arrProducts.find((p) => p.nId === req.body.nProductId);
      arrEvents[nIndex].strProductName = objProduct?.strName || '';
    }

    fnSaveEvents();
    res.json({ bSuccess: true, objEvent: arrEvents[nIndex] });
  } catch (error) {
    console.error('쿼리 템플릿 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 쿼리 템플릿 삭제 (관리자)
export const fnDeleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrEvents.findIndex((e) => e.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '쿼리 템플릿을 찾을 수 없습니다.' });
      return;
    }

    arrEvents.splice(nIndex, 1);
    fnSaveEvents();
    res.json({ bSuccess: true, strMessage: '쿼리 템플릿이 삭제되었습니다.' });
  } catch (error) {
    console.error('쿼리 템플릿 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
