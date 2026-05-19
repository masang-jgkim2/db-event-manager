import { Request, Response } from 'express';
import { arrEvents, fnGetNextEventId, fnSaveEvents, fnReloadEventsFromDiskIfEmpty } from '../data/events';
import { arrEventInstances, fnReloadEventInstancesFromDiskIfEmpty } from '../data/eventInstances';
import { arrProducts } from '../data/products';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnAwaitMysqlDocFlush } from '../db/mysqlDocPersist';

const fnIsPermanentlyRemoved = (e: { bPermanentlyRemoved?: boolean } | undefined): boolean =>
  Boolean(e?.bPermanentlyRemoved);

// 쿼리 템플릿 목록 조회 (모든 인증 사용자)
export const fnGetEvents = async (_req: Request, res: Response): Promise<void> => {
  fnReloadEventsFromDiskIfEmpty();
  res.json({ bSuccess: true, arrEvents });
};

// 쿼리 템플릿에 연결된 이벤트 인스턴스 목록 (템플릿 삭제 전 확인·대시보드 이동용)
export const fnGetEventInstancesByTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objTpl = arrEvents.find((e) => e.nId === nId);
    if (!objTpl) {
      res.status(404).json({ bSuccess: false, strMessage: '쿼리 템플릿을 찾을 수 없습니다.' });
      return;
    }

    fnReloadEventInstancesFromDiskIfEmpty();
    const arrRelated = arrEventInstances
      .filter((i) => i.nEventTemplateId === nId)
      .sort((a, b) => new Date(b.dtCreatedAt).getTime() - new Date(a.dtCreatedAt).getTime());

    const nActiveRefCount = arrRelated.filter((i) => !fnIsPermanentlyRemoved(i)).length;

    res.json({
      bSuccess: true,
      nTemplateId: nId,
      arrInstances: arrRelated,
      nActiveRefCount,
      nRemovedRefCount: arrRelated.length - nActiveRefCount,
    });
  } catch (error) {
    console.error('템플릿 연결 인스턴스 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
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
    if (fnIsMysqlStore()) {
      try {
        await fnAwaitMysqlDocFlush();
      } catch (err: unknown) {
        console.error('[쿼리 템플릿] 생성 MySQL 반영 실패 |', (err as Error)?.message);
        res.status(500).json({ bSuccess: false, strMessage: '등록은 메모리에 반영됐으나 DB 저장에 실패했습니다. 관리자에게 문의하세요.' });
        return;
      }
    }
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
    if (fnIsMysqlStore()) {
      try {
        await fnAwaitMysqlDocFlush();
      } catch (err: unknown) {
        console.error('[쿼리 템플릿] 수정 MySQL 반영 실패 |', (err as Error)?.message);
        res.status(500).json({ bSuccess: false, strMessage: '수정은 메모리에 반영됐으나 DB 저장에 실패했습니다. 관리자에게 문의하세요.' });
        return;
      }
    }
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

    const nRefCount = arrEventInstances.filter(
      (i) => i.nEventTemplateId === nId && !fnIsPermanentlyRemoved(i),
    ).length;
    if (nRefCount > 0) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `이 템플릿을 참조하는 이벤트 인스턴스가 ${nRefCount}건 있어 삭제할 수 없습니다. 목록에서 연결 이벤트를 확인한 뒤 나의 대시보드에서 삭제(복원 불가)하세요.`,
        nActiveRefCount: nRefCount,
      });
      return;
    }

    arrEvents.splice(nIndex, 1);
    fnSaveEvents();
    if (fnIsMysqlStore()) {
      try {
        await fnAwaitMysqlDocFlush();
      } catch (err: unknown) {
        console.error('[쿼리 템플릿] 삭제 MySQL 반영 실패 |', (err as Error)?.message);
        res.status(500).json({ bSuccess: false, strMessage: '삭제는 메모리에 반영됐으나 DB 저장에 실패했습니다. 관리자에게 문의하세요.' });
        return;
      }
    }
    res.json({ bSuccess: true, strMessage: '쿼리 템플릿이 삭제되었습니다.' });
  } catch (error) {
    console.error('쿼리 템플릿 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
