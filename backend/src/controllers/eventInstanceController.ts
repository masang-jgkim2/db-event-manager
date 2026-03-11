import { Request, Response } from 'express';
import {
  arrEventInstances, fnGetNextInstanceId,
  TEventStatus, IStageActor,
} from '../data/eventInstances';
import { fnFindActiveConnection } from '../data/dbConnections';
import { arrProducts } from '../data/products';
import { arrEvents } from '../data/events';
import { fnExecuteQueryWithText } from '../services/queryExecutor';
import { fnBroadcastInstanceUpdate } from '../services/sseBroadcaster';
import { IQueryExecutionResult } from '../types';

// 상태 전이 규칙 (9단계)
const objStatusTransitions: Record<string, { strNextStatus: TEventStatus; arrAllowedRoles: string[] }[]> = {
  event_created:      [{ strNextStatus: 'confirm_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
  confirm_requested:  [{ strNextStatus: 'dba_confirmed',     arrAllowedRoles: ['dba', 'admin'] }],
  dba_confirmed:      [{ strNextStatus: 'qa_requested',      arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
  qa_requested:       [{ strNextStatus: 'qa_deployed',       arrAllowedRoles: ['dba', 'admin'] }],
  qa_deployed:        [{ strNextStatus: 'qa_verified',       arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
  qa_verified:        [{ strNextStatus: 'live_requested',    arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
  live_requested:     [{ strNextStatus: 'live_deployed',     arrAllowedRoles: ['dba', 'admin'] }],
  live_deployed:      [{ strNextStatus: 'live_verified',     arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
};

// 현재 사용자 정보를 IStageActor로 변환
// strActorName(body) > JWT의 strDisplayName > strUserId 순서로 폴백
const fnMakeActor = (req: Request): IStageActor => ({
  strDisplayName: req.body.strActorName || req.user?.strDisplayName || req.user?.strUserId || '',
  nUserId: req.user?.nId || 0,
  strUserId: req.user?.strUserId || '',
  dtProcessedAt: new Date().toISOString(),
});

// 이벤트 인스턴스 생성
export const fnCreateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nEventTemplateId, nProductId, strEventLabel, strProductName,
      strServiceAbbr, strServiceRegion, strCategory, strType,
      strEventName, strInputValues, strGeneratedQuery, dtDeployDate,
      strCreatedBy,
    } = req.body;

    if (!strEventName || !dtDeployDate || !nEventTemplateId) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    const objCreator: IStageActor = {
      strDisplayName: strCreatedBy || req.user?.strDisplayName || req.user?.strUserId || '',
      nUserId: req.user?.nId || 0,
      strUserId: req.user?.strUserId || '',
      dtProcessedAt: new Date().toISOString(),
    };

    const objNew = {
      nId: fnGetNextInstanceId(),
      nEventTemplateId,
      nProductId: Number(nProductId) || 0,
      strEventLabel: strEventLabel || '',
      strProductName: strProductName || '',
      strServiceAbbr: strServiceAbbr || '',
      strServiceRegion: strServiceRegion || '',
      strCategory: strCategory || '',
      strType: strType || '',
      strEventName,
      strInputValues: strInputValues || '',
      strGeneratedQuery: strGeneratedQuery || '',
      dtDeployDate,  // 반영 날짜 (ISO 8601)
      strStatus: 'event_created' as TEventStatus,
      arrStatusLogs: [{
        strStatus: 'event_created' as TEventStatus,
        strChangedBy: objCreator.strDisplayName,
        nChangedByUserId: objCreator.nUserId,
        strComment: '이벤트 생성',
        dtChangedAt: objCreator.dtProcessedAt,
      }],
      // 단계별 처리자
      objCreator,
      objConfirmer: null,
      objQaRequester: null,
      objQaDeployer: null,
      objQaVerifier: null,
      objLiveRequester: null,
      objLiveDeployer: null,
      objLiveVerifier: null,
      // 메타
      strCreatedBy: objCreator.strDisplayName,
      nCreatedByUserId: objCreator.nUserId,
      dtCreatedAt: new Date().toISOString(),
    };

    arrEventInstances.push(objNew);
    // 새 인스턴스 생성 알림 - 모든 연결된 클라이언트에 브로드캐스트
    fnBroadcastInstanceUpdate(objNew);
    res.json({ bSuccess: true, objInstance: objNew });
  } catch (error) {
    console.error('이벤트 인스턴스 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 인스턴스 목록 조회
export const fnGetInstances = async (req: Request, res: Response): Promise<void> => {
  try {
    const nUserId = req.user?.nId || 0;
    const strFilter = req.query.filter as string || 'all';

    let arrFiltered = [...arrEventInstances];

    // 내가 관여한 이벤트 (생성/컨펌/요청/반영/확인 중 하나라도 내가 한 것)
    if (strFilter === 'involved') {
      arrFiltered = arrFiltered.filter((e) =>
        e.objCreator?.nUserId === nUserId ||
        e.objConfirmer?.nUserId === nUserId ||
        e.objQaRequester?.nUserId === nUserId ||
        e.objQaDeployer?.nUserId === nUserId ||
        e.objQaVerifier?.nUserId === nUserId ||
        e.objLiveRequester?.nUserId === nUserId ||
        e.objLiveDeployer?.nUserId === nUserId ||
        e.objLiveVerifier?.nUserId === nUserId
      );
    }

    // 내가 생성한 이벤트만
    if (strFilter === 'mine') {
      arrFiltered = arrFiltered.filter((e) => e.nCreatedByUserId === nUserId);
    }

    // 내가 처리해야 할 이벤트 (역할 기반)
    if (strFilter === 'my_action') {
      const arrUserRoles = req.user?.arrRoles || [];
      arrFiltered = arrFiltered.filter((e) => {
        const arrTrans = objStatusTransitions[e.strStatus] || [];
        return arrTrans.some((t) =>
          t.arrAllowedRoles.some((r) => arrUserRoles.includes(r))
        );
      });
    }

    // 최신순 정렬
    arrFiltered.sort((a, b) => new Date(b.dtCreatedAt).getTime() - new Date(a.dtCreatedAt).getTime());

    res.json({ bSuccess: true, arrInstances: arrFiltered });
  } catch (error) {
    console.error('이벤트 인스턴스 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 상태 변경
export const fnUpdateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const { strNextStatus, strComment } = req.body;
    const arrUserRoles = req.user?.arrRoles || [];

    const objInstance = arrEventInstances.find((e) => e.nId === nId);
    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    // 전이 규칙 확인
    const arrTransitions = objStatusTransitions[objInstance.strStatus] || [];
    const objTransition = arrTransitions.find((t) => t.strNextStatus === strNextStatus);

    if (!objTransition) {
      res.status(400).json({ bSuccess: false, strMessage: '해당 상태로 변경할 수 없습니다.' });
      return;
    }

    // 사용자의 역할 중 하나라도 허용된 역할이면 통과
    const bHasRole = objTransition.arrAllowedRoles.some((r) => arrUserRoles.includes(r));
    if (!bHasRole) {
      res.status(403).json({ bSuccess: false, strMessage: '해당 상태를 변경할 권한이 없습니다.' });
      return;
    }

    // 처리자 기록
    const objActor = fnMakeActor(req);

    // 단계별 처리자 매핑
    switch (strNextStatus) {
      case 'dba_confirmed':   objInstance.objConfirmer = objActor; break;
      case 'qa_requested':    objInstance.objQaRequester = objActor; break;
      case 'qa_deployed':     objInstance.objQaDeployer = objActor; break;
      case 'qa_verified':     objInstance.objQaVerifier = objActor; break;
      case 'live_requested':  objInstance.objLiveRequester = objActor; break;
      case 'live_deployed':   objInstance.objLiveDeployer = objActor; break;
      case 'live_verified':   objInstance.objLiveVerifier = objActor; break;
    }

    // 상태 변경 + 이력 추가
    objInstance.strStatus = strNextStatus;
    objInstance.arrStatusLogs.push({
      strStatus: strNextStatus,
      strChangedBy: objActor.strDisplayName,
      nChangedByUserId: objActor.nUserId,
      strComment: strComment || '',
      dtChangedAt: new Date().toISOString(),
    });

    // 상태 변경 SSE 브로드캐스트
    fnBroadcastInstanceUpdate(objInstance);
    res.json({ bSuccess: true, objInstance });
  } catch (error) {
    console.error('이벤트 상태 변경 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 인스턴스 단건 조회
export const fnGetInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objInstance = arrEventInstances.find((e) => e.nId === nId);
    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }
    res.json({ bSuccess: true, objInstance });
  } catch (error) {
    console.error('이벤트 인스턴스 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// =============================================
// QA/LIVE 반영 - 실제 DB 쿼리 실행 후 상태 전이
// POST /api/event-instances/:id/execute
// Body: { strEnv: 'qa' | 'live' }
// =============================================
export const fnExecuteAndDeploy = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const { strEnv } = req.body as { strEnv: 'dev' | 'qa' | 'live' };

    if (!strEnv || !['dev', 'qa', 'live'].includes(strEnv)) {
      res.status(400).json({ bSuccess: false, strMessage: 'strEnv는 dev, qa, live 중 하나여야 합니다.' });
      return;
    }

    const objInstance = arrEventInstances.find((e) => e.nId === nId);
    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    // 현재 상태가 실행 가능한 단계인지 확인
    // dev는 qa_requested 단계에서 함께 처리 (dev 전용 워크플로 단계 없음)
    const objRequiredStatus: Record<'dev' | 'qa' | 'live', TEventStatus> = {
      dev: 'qa_requested',
      qa: 'qa_requested',
      live: 'live_requested',
    };
    const objDeployedStatus: Record<'dev' | 'qa' | 'live', TEventStatus> = {
      dev: 'qa_deployed',
      qa: 'qa_deployed',
      live: 'live_deployed',
    };
    const objDeployedActorField: Record<'dev' | 'qa' | 'live', 'objQaDeployer' | 'objLiveDeployer'> = {
      dev: 'objQaDeployer',
      qa: 'objQaDeployer',
      live: 'objLiveDeployer',
    };

    if (objInstance.strStatus !== objRequiredStatus[strEnv]) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `${strEnv.toUpperCase()} 반영은 '${objRequiredStatus[strEnv]}' 상태에서만 가능합니다. 현재: ${objInstance.strStatus}`,
      });
      return;
    }

    // nProductId로 직접 DB 접속 정보 조회 (없으면 strProductName으로 폴백)
    let nProductId = objInstance.nProductId;
    if (!nProductId) {
      const objProduct = arrProducts.find((p) => p.strName === objInstance.strProductName);
      nProductId = objProduct?.nId || 0;
    }

    if (!nProductId) {
      res.status(404).json({
        bSuccess: false,
        strMessage: `프로덕트 '${objInstance.strProductName}'를 찾을 수 없습니다. DB 접속 정보 설정을 확인해주세요.`,
      });
      return;
    }

    // 활성 DB 접속 정보 조회
    const objDbConn = fnFindActiveConnection(nProductId, strEnv);
    if (!objDbConn) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `${objInstance.strProductName}의 ${strEnv.toUpperCase()} DB 접속 정보가 없거나 비활성화 상태입니다.`,
      });
      return;
    }

    // ── 반영 날짜 시점 체크 ────────────────────────────────
    // DEV / QA : 현재 시각 < 반영 날짜 → 반영 날짜 이전에만 실행 허용 (사전 검증)
    // LIVE      : 현재 시각 >= 반영 날짜 → 반영 날짜 이후에만 실행 허용 (운영 반영)
    const dtNow = new Date();
    const dtDeploy = new Date(objInstance.dtDeployDate);

    if (isNaN(dtDeploy.getTime())) {
      res.status(400).json({ bSuccess: false, strMessage: '반영 날짜가 올바르지 않습니다.' });
      return;
    }

    if ((strEnv === 'dev' || strEnv === 'qa') && dtNow >= dtDeploy) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `DEV/QA 반영은 반영 날짜(${dtDeploy.toLocaleString('ko-KR')}) 이전에만 실행할 수 있습니다. 현재 시각: ${dtNow.toLocaleString('ko-KR')}`,
      });
      return;
    }

    if (strEnv === 'live' && dtNow < dtDeploy) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `LIVE 반영은 반영 날짜(${dtDeploy.toLocaleString('ko-KR')}) 이후에만 실행할 수 있습니다. 현재 시각: ${dtNow.toLocaleString('ko-KR')}`,
      });
      return;
    }

    // 쿼리 실행
    const objExecResult: IQueryExecutionResult = await fnExecuteQueryWithText(
      objDbConn,
      objInstance.strGeneratedQuery,
      strEnv
    );

    if (!objExecResult.bSuccess) {
      // 실패 시 상태 변경 없이 오류 반환
      res.status(200).json({
        bSuccess: false,
        strMessage: '쿼리 실행에 실패했습니다. 롤백이 완료되었습니다.',
        objExecutionResult: objExecResult,
      });
      return;
    }

    // 실행 성공 → 상태 전이 + 처리자 기록
    const objActor: IStageActor = {
      strDisplayName: req.body.strActorName || req.user?.strDisplayName || req.user?.strUserId || '',
      nUserId: req.user?.nId || 0,
      strUserId: req.user?.strUserId || '',
      dtProcessedAt: new Date().toISOString(),
    };

    const strNextStatus = objDeployedStatus[strEnv];
    const strActorField = objDeployedActorField[strEnv];

    objInstance[strActorField] = objActor;
    objInstance.strStatus = strNextStatus;
    objInstance.arrStatusLogs.push({
      strStatus: strNextStatus,
      strChangedBy: objActor.strDisplayName,
      nChangedByUserId: objActor.nUserId,
      strComment: `${strEnv.toUpperCase()} 반영 완료 - ${objExecResult.nTotalAffectedRows}건 처리 (${objExecResult.nElapsedMs}ms)`,
      dtChangedAt: new Date().toISOString(),
      objExecutionResult: {
        strEnv,
        nTotalAffectedRows: objExecResult.nTotalAffectedRows,
        nElapsedMs: objExecResult.nElapsedMs,
        arrQueryResults: objExecResult.arrQueryResults,
      },
    });

    // DB 실행 후 상태 변경 SSE 브로드캐스트
    fnBroadcastInstanceUpdate(objInstance);
    res.json({
      bSuccess: true,
      strMessage: `${strEnv.toUpperCase()} 반영이 완료되었습니다.`,
      objExecutionResult: objExecResult,
      objInstance,
    });
  } catch (error: any) {
    console.error(`[fnExecuteAndDeploy] 예기치 않은 오류 | instanceId: ${req.params.id} | ${error?.message}`);
    if (error?.stack) console.error(error.stack);
    res.status(500).json({
      bSuccess: false,
      strMessage: `서버 오류가 발생했습니다. (${error?.message || '알 수 없는 오류'})`,
    });
  }
};

// 쿼리 템플릿 치환 헬퍼 (생성/수정에 공통 사용)
const fnApplyQueryTemplate = (
  strTemplate: string,
  strInputValues: string,
  strDeployDate: string,
  strEventName: string,
  strServiceAbbr: string,
  strProductName: string,
  strServiceRegion: string
): string => {
  const strDateOnly = strDeployDate.slice(0, 10);  // YYYY-MM-DD 부분만
  let strQuery = strTemplate;
  strQuery = strQuery.replace(/\{\{items\}\}/g, strInputValues.trim());
  strQuery = strQuery.replace(/\{\{date\}\}/g, strDateOnly);
  strQuery = strQuery.replace(/\{\{event_name\}\}/g, strEventName);
  strQuery = strQuery.replace(/\{\{abbr\}\}/g, strServiceAbbr);
  strQuery = strQuery.replace(/\{\{product\}\}/g, strProductName);
  strQuery = strQuery.replace(/\{\{region\}\}/g, strServiceRegion);
  return strQuery;
};

// 이벤트 인스턴스 수정 (event_created 상태에서만 가능, 생성자만)
// strInputValues 또는 dtDeployDate 변경 시 strGeneratedQuery 자동 재생성
export const fnUpdateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objInstance = arrEventInstances.find((e) => e.nId === nId);

    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    // event_created 상태에서만 수정 가능
    if (objInstance.strStatus !== 'event_created') {
      res.status(400).json({ bSuccess: false, strMessage: '컨펌 요청 전 상태에서만 수정할 수 있습니다.' });
      return;
    }

    // 생성자 본인만 수정 가능 (관리자는 예외)
    const arrUserRoles = req.user?.arrRoles || [];
    if (objInstance.nCreatedByUserId !== req.user?.nId && !arrUserRoles.includes('admin')) {
      res.status(403).json({ bSuccess: false, strMessage: '본인이 생성한 이벤트만 수정할 수 있습니다.' });
      return;
    }

    // 수정 가능한 단순 필드 업데이트
    const arrSimpleFields = ['strEventName', 'strServiceAbbr', 'strServiceRegion'];
    for (const key of arrSimpleFields) {
      if (req.body[key] !== undefined) {
        (objInstance as any)[key] = req.body[key];
      }
    }

    // inputValues 또는 dtDeployDate 변경 시 쿼리 자동 재생성
    const bInputChanged = req.body.strInputValues !== undefined;
    const bDateChanged = req.body.dtDeployDate !== undefined;

    if (bInputChanged) objInstance.strInputValues = req.body.strInputValues;
    if (bDateChanged) objInstance.dtDeployDate = req.body.dtDeployDate;

    if (bInputChanged || bDateChanged) {
      // 원본 이벤트 템플릿의 쿼리 템플릿으로 재생성
      const objTemplate = arrEvents.find((e) => e.nId === objInstance.nEventTemplateId);
      if (objTemplate?.strQueryTemplate) {
        objInstance.strGeneratedQuery = fnApplyQueryTemplate(
          objTemplate.strQueryTemplate,
          objInstance.strInputValues,
          objInstance.dtDeployDate,
          objInstance.strEventName,
          objInstance.strServiceAbbr,
          objInstance.strProductName,
          objInstance.strServiceRegion
        );
      }
    }

    // 수정 후 SSE 브로드캐스트
    fnBroadcastInstanceUpdate(objInstance);
    res.json({ bSuccess: true, objInstance });
  } catch (error) {
    console.error('이벤트 인스턴스 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
