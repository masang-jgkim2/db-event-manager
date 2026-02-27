import { Request, Response } from 'express';
import { arrEvents, fnGetNextEventId } from '../data/events';
import { arrProducts } from '../data/products';

// 이벤트 목록 조회 (모든 인증 사용자)
export const fnGetEvents = async (_req: Request, res: Response): Promise<void> => {
  res.json({ bSuccess: true, arrEvents });
};

// 이벤트 추가 (관리자)
export const fnCreateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nProductId, strEventLabel, strDescription,
      strCategory, strType, strInputFormat,
      strDefaultItems, strQueryTemplate,
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
      dtCreatedAt: new Date().toISOString(),
    };

    arrEvents.push(objNew);
    res.json({ bSuccess: true, objEvent: objNew });
  } catch (error) {
    console.error('이벤트 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 수정 (관리자)
export const fnUpdateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrEvents.findIndex((e) => e.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    const fields = [
      'nProductId', 'strEventLabel', 'strDescription',
      'strCategory', 'strType', 'strInputFormat',
      'strDefaultItems', 'strQueryTemplate',
    ];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        (arrEvents[nIndex] as any)[key] = req.body[key];
      }
    }

    // 프로덕트명 갱신
    if (req.body.nProductId !== undefined) {
      const objProduct = arrProducts.find((p) => p.nId === req.body.nProductId);
      arrEvents[nIndex].strProductName = objProduct?.strName || '';
    }

    res.json({ bSuccess: true, objEvent: arrEvents[nIndex] });
  } catch (error) {
    console.error('이벤트 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 삭제 (관리자)
export const fnDeleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const nIndex = arrEvents.findIndex((e) => e.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    arrEvents.splice(nIndex, 1);
    res.json({ bSuccess: true, strMessage: '이벤트가 삭제되었습니다.' });
  } catch (error) {
    console.error('이벤트 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
