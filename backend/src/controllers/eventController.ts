import { Request, Response } from 'express';
import {
  arrEvents, fnGetNextEventId, fnSaveEvents, fnReloadEventsFromDiskIfEmpty,
  fnResolveTemplateStatus, fnCommitEventTemplateDeleteToStore,
  type IEventTemplate, type ITemplateStageActor, type TTemplateStatus,
} from '../data/events';
import { arrEventInstances, fnReloadEventInstancesFromDiskIfEmpty, fnSaveEventInstances, fnCommitEventInstancesToStore, type IEventInstance } from '../data/eventInstances';
import { arrProducts } from '../data/products';
import { fnFindConnectionById } from '../data/dbConnections';
import {
  fnNormalizeQueryTemplateConnFields,
  fnValidateQaLiveConnectionPair,
} from '../utils/queryTemplateConnections';
import {
  fnIsValidQuerySetInputId,
  fnNormalizeQuerySetInputFields,
} from '../utils/querySetInput';
import type { IQueryTemplateItem } from '../data/events';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnAwaitMysqlDocFlush } from '../db/mysqlDocPersist';
import { fnGetEventTemplateDeleteBlockReason } from '../db/mysqlRelationalSync';
import type { TPermission } from '../types';
import {
  fnBodyHasTemplateQueryFields,
  fnBuildTemplateQueryEditLog,
  fnMergeTemplateQueryFromBody,
  fnSnapshotTemplateQueryBefore,
  fnTemplateQueryBodyChanged,
} from '../utils/queryEditLog';
import { fnNotifySlackTemplateStatus } from '../services/slackNotifier';

const OBJ_TEMPLATE_TRANSITIONS: Partial<Record<TTemplateStatus, { strNextStatus: TTemplateStatus; strPermission: TPermission }[]>> = {
  template_created: [{ strNextStatus: 'confirm_requested', strPermission: 'event_template.request_confirm' }],
  confirm_requested: [{ strNextStatus: 'dba_confirmed', strPermission: 'event_template.confirm' }],
};

const OBJ_TEMPLATE_STATUS_PERMISSION: Partial<Record<TTemplateStatus, TPermission>> = {
  confirm_requested: 'event_template.request_confirm',
  dba_confirmed: 'event_template.confirm',
};

const fnIsTemplatePersistConflict = (strMessage: string): boolean =>
  strMessage.includes('사용 중') || strMessage.includes('삭제할 수 없습니다') || strMessage.includes('참조');

const fnMakeTemplateActor = (req: Request): ITemplateStageActor => ({
  strDisplayName: req.body?.strActorName || req.user?.strDisplayName || req.user?.strUserId || '',
  nUserId: req.user?.nId || 0,
  strUserId: req.user?.strUserId || '',
  dtProcessedAt: new Date().toISOString(),
});

/** D2: 승인 완료 템플릿 쿼리·세트 변경 시 재리뷰 요청으로 되돌림 */
const fnRevertTemplateToReapproval = (
  objTpl: IEventTemplate,
  objActor: ITemplateStageActor,
  strComment: string,
): void => {
  objTpl.strStatus = 'confirm_requested';
  objTpl.objConfirmer = null;
  objTpl.arrStatusLogs.push({
    strStatus: 'confirm_requested',
    strChangedBy: objActor.strDisplayName,
    nChangedByUserId: objActor.nUserId,
    strComment,
    dtChangedAt: objActor.dtProcessedAt,
  });
};

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
const fnValidateTemplateQueryConnections = (
  nProductId: number,
  arrQueryTemplates?: IQueryTemplateItem[],
): string | null => {
  if (!Array.isArray(arrQueryTemplates)) return null;
  for (const objSet of arrQueryTemplates) {
    const objNorm = fnNormalizeQueryTemplateConnFields(objSet);
    const strErr = fnValidateQaLiveConnectionPair(
      nProductId,
      objNorm.nQaDbConnectionId,
      objNorm.nLiveDbConnectionId,
    );
    if (strErr) return strErr;
  }
  return null;
};

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

    const arrSets = Array.isArray(arrQueryTemplates) ? arrQueryTemplates : undefined;
    if (arrSets?.length) {
      const strConnErr = fnValidateTemplateQueryConnections(Number(nProductId), arrSets);
      if (strConnErr) {
        res.status(400).json({ bSuccess: false, strMessage: strConnErr });
        return;
      }
    }

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
    const strTplStatus = fnResolveTemplateStatus(objTpl);
    const bQueryFieldsInBody = fnBodyHasTemplateQueryFields(req.body);
    const objMergedQuery = fnMergeTemplateQueryFromBody(objTpl, req.body);
    const bQueryWouldChange = bQueryFieldsInBody && fnTemplateQueryBodyChanged(objTpl, objMergedQuery);

    // 리뷰 대기 중 쿼리·세트는 전용 API만 허용
    if (strTplStatus === 'confirm_requested' && bQueryWouldChange) {
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

    const nProductIdForConn = req.body.nProductId !== undefined
      ? Number(req.body.nProductId)
      : objTpl.nProductId;
    if (Array.isArray(req.body.arrQueryTemplates) && req.body.arrQueryTemplates.length > 0) {
      const strConnErr = fnValidateTemplateQueryConnections(nProductIdForConn, req.body.arrQueryTemplates);
      if (strConnErr) {
        res.status(400).json({ bSuccess: false, strMessage: strConnErr });
        return;
      }
    }

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
    if (strTplStatus === 'dba_confirmed' && bQueryWouldChange) {
      const objActor = fnMakeTemplateActor(req);
      fnRevertTemplateToReapproval(arrEvents[nIndex], objActor, '승인 후 쿼리·세트 변경 — DBA 재승인 필요');
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
    if (bReapprovalRequired) {
      fnNotifySlackTemplateStatus(arrEvents[nIndex]);
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

    const strTplStatus = fnResolveTemplateStatus(objTpl);
    if (strTplStatus !== 'confirm_requested' && strTplStatus !== 'dba_confirmed') {
      res.status(400).json({ bSuccess: false, strMessage: '쿼리 리뷰 대기 또는 승인 완료 상태에서만 DBA 쿼리 수정이 가능합니다.' });
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
      const arrIncoming = Array.isArray(req.body.arrQueryTemplates)
        ? req.body.arrQueryTemplates
        : undefined;
      if (arrIncoming?.length) {
        const strConnErr = fnValidateTemplateQueryConnections(objTpl.nProductId, arrIncoming);
        if (strConnErr) {
          res.status(400).json({ bSuccess: false, strMessage: strConnErr });
          return;
        }
      }
      objTpl.arrQueryTemplates = arrIncoming;
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
    let bReapprovalRequired = false;
    if (strTplStatus === 'dba_confirmed') {
      fnRevertTemplateToReapproval(objTpl, objActor, '승인 후 DBA 쿼리 수정 — DBA 재승인 필요');
      bReapprovalRequired = true;
      console.log(`[쿼리 템플릿] D2 재승인 | #${nId} | dba_confirmed → confirm_requested (query API)`);
    } else {
      objTpl.arrStatusLogs.push({
        strStatus: 'confirm_requested',
        strChangedBy: objActor.strDisplayName,
        nChangedByUserId: objActor.nUserId,
        strComment: 'DBA 쿼리 리뷰 중 수정',
        dtChangedAt: objActor.dtProcessedAt,
        objQueryEdit,
      });
      console.log(`[쿼리 템플릿] DBA 쿼리 수정 | #${nId} | confirm_requested 유지`);
    }

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

    if (bReapprovalRequired) {
      fnNotifySlackTemplateStatus(objTpl);
    }
    res.json({ bSuccess: true, objEvent: objTpl, bReapprovalRequired });
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

    if (fnIsMysqlStore()) {
      const pool = fnGetMysqlAppPool();
      const conn = await pool.getConnection();
      try {
        const strMysqlBlock = await fnGetEventTemplateDeleteBlockReason(conn, nId);
        if (strMysqlBlock) {
          res.status(400).json({ bSuccess: false, strMessage: strMysqlBlock });
          return;
        }
      } finally {
        conn.release();
      }
    }

    const objRemoved = arrEvents[nIndex];
    const arrPurgedInstances: IEventInstance[] = [];
    for (let i = arrEventInstances.length - 1; i >= 0; i--) {
      const inst = arrEventInstances[i];
      if (inst.nEventTemplateId === nId && fnIsPermanentlyRemoved(inst)) {
        arrPurgedInstances.push(inst);
        arrEventInstances.splice(i, 1);
      }
    }
    if (arrPurgedInstances.length > 0) {
      console.log(`[쿼리 템플릿] 삭제 | nId=${nId} | 영구삭제 인스턴스 ${arrPurgedInstances.length}건 정리`);
    }

    arrEvents.splice(nIndex, 1);
    try {
      if (fnIsMysqlStore()) {
        if (arrPurgedInstances.length > 0) {
          await fnCommitEventInstancesToStore();
        }
        await fnCommitEventTemplateDeleteToStore(nId);
      } else {
        if (arrPurgedInstances.length > 0) fnSaveEventInstances();
        fnSaveEvents();
      }
    } catch (errPersist: unknown) {
      arrEvents.splice(nIndex, 0, objRemoved);
      for (const inst of arrPurgedInstances.reverse()) {
        arrEventInstances.push(inst);
      }
      const strMessage = (errPersist as Error)?.message ?? '쿼리 템플릿 삭제에 실패했습니다.';
      console.error('[쿼리 템플릿] 삭제 MySQL 반영 실패 |', strMessage);
      res.status(fnIsTemplatePersistConflict(strMessage) ? 409 : 500).json({
        bSuccess: false,
        strMessage,
      });
      return;
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
    if (strNextStatus === 'confirm_requested') {
      fnNotifySlackTemplateStatus(objTpl);
    }
    res.json({ bSuccess: true, objEvent: objTpl });
  } catch (error) {
    console.error('쿼리 템플릿 상태 변경 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

/** my_action 필터용 — 템플릿 다음 액션 권한 (컨트롤러 외부 테스트·문서용) */
export const fnGetTemplateStatusActionPermission = (strStatus: TTemplateStatus): TPermission | undefined =>
  OBJ_TEMPLATE_STATUS_PERMISSION[strStatus];
