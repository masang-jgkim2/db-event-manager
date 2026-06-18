import { Request, Response } from 'express';
import {
  arrEvents, fnGetNextEventId, fnSaveEvents, fnReloadEventsFromDiskIfEmpty,
  type IEventTemplate, type ITemplateStageActor, type TTemplateStatus,
} from '../data/events';
import { arrEventInstances, fnReloadEventInstancesFromDiskIfEmpty, fnSaveEventInstances } from '../data/eventInstances';
import { arrProducts } from '../data/products';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnAwaitMysqlDocFlush } from '../db/mysqlDocPersist';
import type { TPermission } from '../types';
import {
  fnBodyHasTemplateQueryFields,
  fnBuildTemplateQueryEditLog,
  fnMergeTemplateQueryFromBody,
  fnSnapshotTemplateQueryBefore,
  fnTemplateQueryBodyChanged,
} from '../utils/queryEditLog';

const OBJ_TEMPLATE_TRANSITIONS: Partial<Record<TTemplateStatus, { strNextStatus: TTemplateStatus; strPermission: TPermission }[]>> = {
  template_created: [{ strNextStatus: 'confirm_requested', strPermission: 'event_template.request_confirm' }],
  confirm_requested: [{ strNextStatus: 'dba_confirmed', strPermission: 'event_template.confirm' }],
};

const OBJ_TEMPLATE_STATUS_PERMISSION: Partial<Record<TTemplateStatus, TPermission>> = {
  confirm_requested: 'event_template.request_confirm',
  dba_confirmed: 'event_template.confirm',
};

const fnMakeTemplateActor = (req: Request): ITemplateStageActor => ({
  strDisplayName: req.body?.strActorName || req.user?.strDisplayName || req.user?.strUserId || '',
  nUserId: req.user?.nId || 0,
  strUserId: req.user?.strUserId || '',
  dtProcessedAt: new Date().toISOString(),
});

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

    const nCreatorUserId = req.user?.nId && req.user.nId > 0 ? req.user.nId : undefined;
    const strCreatorName = req.user?.strDisplayName?.trim() || req.user?.strUserId?.trim() || '';

    const objCreator = fnMakeTemplateActor(req);
    const dtNow = new Date().toISOString();

    const objNew: IEventTemplate = {
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
      dtCreatedAt: dtNow,
      strCreatedBy: strCreatorName || undefined,
      nCreatedByUserId: nCreatorUserId,
      strStatus: 'template_created',
      arrStatusLogs: [{
        strStatus: 'template_created',
        strChangedBy: objCreator.strDisplayName,
        nChangedByUserId: objCreator.nUserId,
        strComment: '쿼리 템플릿 등록',
        dtChangedAt: dtNow,
      }],
      objCreator,
      objConfirmer: null,
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

    const objTpl = arrEvents[nIndex];
    const bQueryFieldsInBody = fnBodyHasTemplateQueryFields(req.body);
    const objMergedQuery = fnMergeTemplateQueryFromBody(objTpl, req.body);
    const bQueryWouldChange = bQueryFieldsInBody && fnTemplateQueryBodyChanged(objTpl, objMergedQuery);

    // 리뷰 대기 중 쿼리·세트는 전용 API만 허용
    if (objTpl.strStatus === 'confirm_requested' && bQueryWouldChange) {
      res.status(400).json({
        bSuccess: false,
        strMessage: '쿼리 리뷰 대기 중에는 쿼리·세트를 이 경로로 수정할 수 없습니다. DBA 쿼리 수정 기능을 사용하세요.',
      });
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

    // D2: 승인 완료 후 쿼리·세트 변경 → 재리뷰 요청 상태로 되돌림
    let bReapprovalRequired = false;
    if (objTpl.strStatus === 'dba_confirmed' && bQueryWouldChange) {
      const objActor = fnMakeTemplateActor(req);
      const dtNow = new Date().toISOString();
      arrEvents[nIndex].strStatus = 'confirm_requested';
      arrEvents[nIndex].objConfirmer = null;
      arrEvents[nIndex].arrStatusLogs.push({
        strStatus: 'confirm_requested',
        strChangedBy: objActor.strDisplayName,
        nChangedByUserId: objActor.nUserId,
        strComment: '승인 후 쿼리·세트 변경 — DBA 재승인 필요',
        dtChangedAt: dtNow,
      });
      bReapprovalRequired = true;
      console.log(`[쿼리 템플릿] D2 재승인 | #${nId} | dba_confirmed → confirm_requested`);
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
    res.json({ bSuccess: true, objEvent: arrEvents[nIndex], bReapprovalRequired });
  } catch (error) {
    console.error('쿼리 템플릿 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

/** DBA 리뷰 대기(confirm_requested) 중 쿼리·세트만 수정 — 상태 유지, diff 로그 기록 */
export const fnUpdateEventQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objTpl = arrEvents.find((e) => e.nId === nId);
    if (!objTpl) {
      res.status(404).json({ bSuccess: false, strMessage: '쿼리 템플릿을 찾을 수 없습니다.' });
      return;
    }

    if (objTpl.strStatus !== 'confirm_requested') {
      res.status(400).json({ bSuccess: false, strMessage: '쿼리 리뷰 대기 상태에서만 DBA 쿼리 수정이 가능합니다.' });
      return;
    }

    const arrUserPerms = req.user?.arrPermissions || [];
    if (!(arrUserPerms as string[]).includes('event_template.confirm')
      && !(arrUserPerms as string[]).includes('event_template.manage')) {
      res.status(403).json({ bSuccess: false, strMessage: 'DBA 쿼리 수정 권한(event_template.confirm)이 필요합니다.' });
      return;
    }

    if (!fnBodyHasTemplateQueryFields(req.body)) {
      res.status(400).json({ bSuccess: false, strMessage: '수정할 쿼리·세트 필드가 없습니다.' });
      return;
    }

    const objQueryBefore = fnSnapshotTemplateQueryBefore(objTpl);

    if (req.body.strQueryTemplate !== undefined) {
      objTpl.strQueryTemplate = req.body.strQueryTemplate;
    }
    if (req.body.strDefaultItems !== undefined) {
      objTpl.strDefaultItems = req.body.strDefaultItems;
    }
    if (req.body.arrQueryTemplates !== undefined) {
      objTpl.arrQueryTemplates = Array.isArray(req.body.arrQueryTemplates)
        ? req.body.arrQueryTemplates
        : undefined;
    }

    const bSingleMode = req.body.strQueryTemplate !== undefined
      && (!Array.isArray(req.body.arrQueryTemplates) || req.body.arrQueryTemplates.length === 0);
    if (bSingleMode) {
      objTpl.arrQueryTemplates = undefined;
    }

    const objQueryEdit = fnBuildTemplateQueryEditLog(objQueryBefore, objTpl);
    if (!objQueryEdit) {
      res.status(400).json({ bSuccess: false, strMessage: '쿼리 내용이 변경되지 않았습니다.' });
      return;
    }

    const objActor = fnMakeTemplateActor(req);
    objTpl.arrStatusLogs.push({
      strStatus: 'confirm_requested',
      strChangedBy: objActor.strDisplayName,
      nChangedByUserId: objActor.nUserId,
      strComment: 'DBA 쿼리 리뷰 중 수정',
      dtChangedAt: new Date().toISOString(),
      objQueryEdit,
    });

    fnSaveEvents();
    if (fnIsMysqlStore()) {
      try {
        await fnAwaitMysqlDocFlush();
      } catch (err: unknown) {
        console.error('[쿼리 템플릿] DBA 쿼리 수정 MySQL 반영 실패 |', (err as Error)?.message);
        res.status(500).json({ bSuccess: false, strMessage: '수정은 메모리에 반영됐으나 DB 저장에 실패했습니다.' });
        return;
      }
    }

    console.log(`[쿼리 템플릿] DBA 쿼리 수정 | #${nId} | confirm_requested 유지`);
    res.json({ bSuccess: true, objEvent: objTpl });
  } catch (error) {
    console.error('쿼리 템플릿 DBA 쿼리 수정 오류:', error);
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

    // 영구 삭제된 인스턴스만 이 템플릿을 참조할 때 MySQL FK·스텁 없이 반영되도록 참조 인스턴스 제거
    let nPurgedRemovedRefs = 0;
    for (let i = arrEventInstances.length - 1; i >= 0; i--) {
      const inst = arrEventInstances[i];
      if (inst.nEventTemplateId === nId && fnIsPermanentlyRemoved(inst)) {
        arrEventInstances.splice(i, 1);
        nPurgedRemovedRefs += 1;
      }
    }
    if (nPurgedRemovedRefs > 0) {
      console.log(`[쿼리 템플릿] 삭제 | nId=${nId} | 영구삭제 인스턴스 ${nPurgedRemovedRefs}건 정리`);
      fnSaveEventInstances();
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

// 쿼리 템플릿 상태 전이 (등록 → 리뷰 요청 → DBA 승인)
export const fnUpdateEventStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const { strNextStatus, strComment } = req.body as { strNextStatus?: TTemplateStatus; strComment?: string };

    const objTpl = arrEvents.find((e) => e.nId === nId);
    if (!objTpl) {
      res.status(404).json({ bSuccess: false, strMessage: '쿼리 템플릿을 찾을 수 없습니다.' });
      return;
    }

    const arrTransitions = OBJ_TEMPLATE_TRANSITIONS[objTpl.strStatus] ?? [];
    const objTransition = arrTransitions.find((t) => t.strNextStatus === strNextStatus);
    if (!objTransition) {
      res.status(400).json({ bSuccess: false, strMessage: '해당 상태로 변경할 수 없습니다.' });
      return;
    }

    const arrUserPerms = req.user?.arrPermissions || [];
    if (!(arrUserPerms as string[]).includes(objTransition.strPermission)) {
      const strPerm = objTransition.strPermission;
      res.status(403).json({
        bSuccess: false,
        strMessage: `해당 상태를 변경할 권한이 없습니다. 필요: '${strPerm}'.`,
      });
      return;
    }

    const objActor = fnMakeTemplateActor(req);
    if (strNextStatus === 'dba_confirmed') {
      objTpl.objConfirmer = objActor;
    }

    objTpl.strStatus = strNextStatus!;
    objTpl.arrStatusLogs.push({
      strStatus: strNextStatus!,
      strChangedBy: objActor.strDisplayName,
      nChangedByUserId: objActor.nUserId,
      strComment: strComment || '',
      dtChangedAt: new Date().toISOString(),
    });

    fnSaveEvents();
    if (fnIsMysqlStore()) {
      try {
        await fnAwaitMysqlDocFlush();
      } catch (err: unknown) {
        console.error('[쿼리 템플릿] 상태 변경 MySQL 반영 실패 |', (err as Error)?.message);
        res.status(500).json({ bSuccess: false, strMessage: '변경은 메모리에 반영됐으나 DB 저장에 실패했습니다.' });
        return;
      }
    }

    console.log(`[쿼리 템플릿] 상태 변경 | #${nId} | ${objTpl.strStatus}`);
    res.json({ bSuccess: true, objEvent: objTpl });
  } catch (error) {
    console.error('쿼리 템플릿 상태 변경 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

/** my_action 필터용 — 템플릿 다음 액션 권한 (컨트롤러 외부 테스트·문서용) */
export const fnGetTemplateStatusActionPermission = (strStatus: TTemplateStatus): TPermission | undefined =>
  OBJ_TEMPLATE_STATUS_PERMISSION[strStatus];
