import { Request, Response } from 'express';
import {
  arrEventInstances, fnGetNextInstanceId, fnSaveEventInstances,
  TEventStatus, IStageActor,
} from '../data/eventInstances';
import { fnFindActiveConnection, fnFindConnectionById } from '../data/dbConnections';
import { arrProducts } from '../data/products';
import { arrEvents } from '../data/events';
import { fnExecuteQueryWithText } from '../services/queryExecutor';
import { fnBroadcastInstanceUpdate, fnBroadcastInstanceCreated } from '../services/sseBroadcaster';
import { IQueryExecutionResult } from '../types';

// 상태 전이 규칙 (9단계 + 재요청)
// arrDeployScope=['live']인 경우 fnGetTransitions에서 QA 단계 스킵
const OBJ_STATUS_TRANSITIONS_BASE: Record<string, { strNextStatus: TEventStatus; arrAllowedRoles: string[] }[]> = {
  event_created:      [{ strNextStatus: 'confirm_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }],
  confirm_requested:  [{ strNextStatus: 'dba_confirmed',     arrAllowedRoles: ['dba', 'admin'] }],
  qa_requested:       [{ strNextStatus: 'qa_deployed',       arrAllowedRoles: ['dba', 'admin'] }],
  // QA 반영 후: 확인 또는 확인 전 재반영 요청 (재미 모드 롱프레스)
  qa_deployed:        [
    { strNextStatus: 'qa_verified',  arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
    { strNextStatus: 'qa_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
  ],
  // QA 확인 후: 정상 진행(LIVE 요청) 또는 데이터 문제 시 QA 재반영 요청
  qa_verified:        [
    { strNextStatus: 'live_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
    { strNextStatus: 'qa_requested',  arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
  ],
  live_requested:     [{ strNextStatus: 'live_deployed',     arrAllowedRoles: ['dba', 'admin'] }],
  // LIVE 반영 후: 확인 또는 확인 전 재반영 요청 (재미 모드 롱프레스)
  live_deployed:      [
    { strNextStatus: 'live_verified',  arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
    { strNextStatus: 'live_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
  ],
  // 완료 후: 데이터 문제 시 LIVE 재반영 요청
  live_verified:      [
    { strNextStatus: 'live_requested', arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] },
  ],
};

// 반영 범위에 따른 동적 전이 조회
// LIVE only: dba_confirmed → live_requested (QA 단계 스킵)
const fnGetTransitions = (
  strStatus: string,
  arrScope: Array<'qa' | 'live'>
): { strNextStatus: TEventStatus; arrAllowedRoles: string[] }[] => {
  if (strStatus === 'dba_confirmed') {
    const bHasQa = arrScope.includes('qa');
    const strNext: TEventStatus = bHasQa ? 'qa_requested' : 'live_requested';
    return [{ strNextStatus: strNext, arrAllowedRoles: ['game_manager', 'game_designer', 'admin'] }];
  }
  return OBJ_STATUS_TRANSITIONS_BASE[strStatus] ?? [];
};

// 액션(다음 상태)별 필요 권한 — 수행 여부는 권한만으로 판단 (역할 사용 안 함)
const OBJ_STATUS_REQUIRED_PERMISSION: Partial<Record<TEventStatus, string>> = {
  confirm_requested: 'my_dashboard.request_confirm',
  dba_confirmed:      'my_dashboard.confirm',
  qa_requested:       'my_dashboard.request_qa',
  qa_verified:        'my_dashboard.verify_qa',
  live_requested:     'my_dashboard.request_live',
  live_verified:      'my_dashboard.verify_live',
};

// 상태별 "다음 액션 가능" 권한 목록 — my_action 필터용 (권한 기반)
const OBJ_STATUS_ACTION_PERMISSIONS: Partial<Record<TEventStatus, string[]>> = {
  event_created:      ['my_dashboard.request_confirm'],
  confirm_requested:  ['my_dashboard.confirm'],
  qa_requested:        ['my_dashboard.execute_qa', 'instance.execute_qa'],
  qa_deployed:        ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq'],
  qa_verified:        ['my_dashboard.request_live', 'my_dashboard.request_qa_rereq'],
  live_requested:     ['my_dashboard.execute_live', 'instance.execute_live'],
  live_deployed:      ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
  live_verified:       ['my_dashboard.request_live_rereq'],
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
      strEventName, strInputValues, strGeneratedQuery, arrExecutionTargets, dtDeployDate,
      arrDeployScope: arrReqScope, strCreatedBy,
    } = req.body;

    if (!strEventName || !dtDeployDate || !nEventTemplateId) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    // 반영 범위 검증: DEV 불가, 최소 1개 이상, 기본값 ['qa','live']
    const arrAllowed = ['qa', 'live'];
    const arrDeployScope: Array<'qa' | 'live'> =
      Array.isArray(arrReqScope) && arrReqScope.length > 0
        ? arrReqScope.filter((s: string) => arrAllowed.includes(s))
        : ['qa', 'live'];

    if (arrDeployScope.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '반영 범위는 QA 또는 LIVE 중 하나 이상 선택해야 합니다.' });
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
      arrExecutionTargets: Array.isArray(arrExecutionTargets) ? arrExecutionTargets : undefined,
      dtDeployDate,
      arrDeployScope,
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
    fnSaveEventInstances();
    // 생성자 외 모든 클라이언트에 신규 이벤트 알림 (instance_created)
    fnBroadcastInstanceCreated(objNew);
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

    // 내가 처리해야 할 이벤트 (권한 기반)
    if (strFilter === 'my_action') {
      const arrUserPerms = req.user?.arrPermissions || [];
      arrFiltered = arrFiltered.filter((e) => {
        const arrPerms = OBJ_STATUS_ACTION_PERMISSIONS[e.strStatus as TEventStatus];
        return arrPerms?.some((p) => (arrUserPerms as string[]).includes(p)) ?? false;
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

    const objInstance = arrEventInstances.find((e) => e.nId === nId);
    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    // 전이 규칙 확인 (반영 범위 반영)
    const arrScope = objInstance.arrDeployScope ?? ['qa', 'live'];
    const arrTransitions = fnGetTransitions(objInstance.strStatus, arrScope);
    const objTransition = arrTransitions.find((t) => t.strNextStatus === strNextStatus);

    if (!objTransition) {
      res.status(400).json({ bSuccess: false, strMessage: '해당 상태로 변경할 수 없습니다.' });
      return;
    }

    // 해당 액션의 필요 권한으로만 허용 (역할 미사용)
    const arrUserPerms = req.user?.arrPermissions || [];
    const strRequiredPerm = OBJ_STATUS_REQUIRED_PERMISSION[strNextStatus as TEventStatus];
    const bHasPerm = strRequiredPerm ? (arrUserPerms as string[]).includes(strRequiredPerm) : false;
    if (!bHasPerm) {
      res.status(403).json({
        bSuccess: false,
        strMessage: strRequiredPerm
          ? `해당 상태를 변경할 권한이 없습니다. 필요: '${strRequiredPerm}'. 권한을 방금 수정했다면 로그아웃 후 다시 로그인해 주세요.`
          : '해당 상태를 변경할 권한이 없습니다.',
      });
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

    fnSaveEventInstances();
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

    // env별 실행 권한만으로 허용 (역할 미사용)
    const arrUserPerms = req.user?.arrPermissions || [];
    const arrPermsForEnv = strEnv === 'live'
      ? ['my_dashboard.execute_live', 'instance.execute_live']
      : ['my_dashboard.execute_qa', 'instance.execute_qa'];
    const bHasPerm = arrPermsForEnv.some((p) => (arrUserPerms as string[]).includes(p));
    if (!bHasPerm) {
      res.status(403).json({
        bSuccess: false,
        strMessage: `이 작업을 하려면 권한 '${arrPermsForEnv[0]}' 또는 '${arrPermsForEnv[1]}'이 필요합니다.`,
      });
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

    // 반영 범위에 포함된 환경인지 확인 (DEV는 항상 차단)
    if (strEnv === 'dev') {
      res.status(400).json({ bSuccess: false, strMessage: 'DEV 환경 직접 실행은 지원하지 않습니다.' });
      return;
    }
    const arrScope = objInstance.arrDeployScope ?? ['qa', 'live'];
    if (!arrScope.includes(strEnv as 'qa' | 'live')) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `이 이벤트의 반영 범위에 ${strEnv.toUpperCase()}이 포함되어 있지 않습니다. (설정된 범위: ${arrScope.join(', ').toUpperCase()})`,
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

    // ── 반영 날짜 시점 체크 ────────────────────────────────
    // QA  : 시간 제한 없음 — LIVE 반영 전 언제든지 실행 가능
    // LIVE : 현재 시각 >= 반영 날짜 → 반영 날짜 이후에만 실행 허용 (운영 반영)
    const dtNow = new Date();
    const dtDeploy = new Date(objInstance.dtDeployDate);

    if (isNaN(dtDeploy.getTime())) {
      res.status(400).json({ bSuccess: false, strMessage: '반영 날짜가 올바르지 않습니다.' });
      return;
    }

    if (strEnv === 'live' && dtNow < dtDeploy) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `LIVE 반영은 반영 날짜(${dtDeploy.toLocaleString('ko-KR')}) 이후에만 실행할 수 있습니다. 현재 시각: ${dtNow.toLocaleString('ko-KR')}`,
      });
      return;
    }

    // 쿼리 실행: 실행 대상 목록 있으면 DB 연결별 실행, 없으면 단일 strGeneratedQuery
    let objExecResult: IQueryExecutionResult;

    const arrTargets = objInstance.arrExecutionTargets;
    if (Array.isArray(arrTargets) && arrTargets.length > 0) {
      // 현재 환경(strEnv)에 해당하는 대상만 필터 후 순차 실행
      const arrAllPartResults: IQueryExecutionResult['arrQueryResults'] = [];
      let nTotalRows = 0;
      let nTotalMs = 0;
      const arrExecutedQueries: string[] = [];

      const arrTargetsForEnv = arrTargets.filter((item) => {
        const c = fnFindConnectionById(item.nDbConnectionId);
        return c?.bIsActive && c.strEnv === strEnv;
      });
      if (arrTargetsForEnv.length === 0) {
        res.status(400).json({
          bSuccess: false,
          strMessage: `${strEnv.toUpperCase()} 환경에 해당하는 DB 접속이 템플릿에 없거나 비활성화 상태입니다.`,
        });
        return;
      }

      for (const item of arrTargetsForEnv) {
        const objConn = fnFindConnectionById(item.nDbConnectionId);
        if (!objConn || !objConn.bIsActive) continue;
        const objOne = await fnExecuteQueryWithText(objConn, item.strQuery, strEnv);
        if (!objOne.bSuccess) {
          res.status(200).json({
            bSuccess: false,
            strMessage: `쿼리 실행 실패 (${objConn.strProductName} ${objConn.strEnv}). 롤백이 완료되었습니다.`,
            objExecutionResult: objOne,
          });
          return;
        }
        arrAllPartResults.push(...objOne.arrQueryResults);
        nTotalRows += objOne.nTotalAffectedRows;
        nTotalMs += objOne.nElapsedMs;
        arrExecutedQueries.push(item.strQuery);
      }

      objExecResult = {
        bSuccess: true,
        strEnv,
        strExecutedQuery: arrExecutedQueries.join('\n;\n'),
        arrQueryResults: arrAllPartResults,
        nTotalAffectedRows: nTotalRows,
        nElapsedMs: nTotalMs,
        dtExecutedAt: new Date().toISOString(),
      };
    } else {
      const objDbConn = fnFindActiveConnection(nProductId, strEnv);
      if (!objDbConn) {
        res.status(400).json({
          bSuccess: false,
          strMessage: `${objInstance.strProductName}의 ${strEnv.toUpperCase()} DB 접속 정보가 없거나 비활성화 상태입니다.`,
        });
        return;
      }
      objExecResult = await fnExecuteQueryWithText(
        objDbConn,
        objInstance.strGeneratedQuery,
        strEnv
      );
    }

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

    fnSaveEventInstances();
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

// 이벤트 인스턴스 수정
// - event_created: 생성자(또는 admin)만 → 모든 필드 수정 가능
// - confirm_requested / dba_confirmed / qa_requested / qa_deployed / qa_verified
//   / live_requested / live_deployed: DBA(또는 admin)만 → strGeneratedQuery 직접 수정 가능
export const fnUpdateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objInstance = arrEventInstances.find((e) => e.nId === nId);

    if (!objInstance) {
      res.status(404).json({ bSuccess: false, strMessage: '이벤트를 찾을 수 없습니다.' });
      return;
    }

    const arrUserPerms = req.user?.arrPermissions || [];
    const bHasQueryEdit = (arrUserPerms as string[]).includes('my_dashboard.query_edit');
    const bHasEditAny = (arrUserPerms as string[]).includes('my_dashboard.edit_any');

    // ── 쿼리 수정 (요청 대기 단계) — my_dashboard.query_edit 권한만 사용
    const ARR_QUERY_EDITABLE_STATUSES: TEventStatus[] = [
      'confirm_requested', 'qa_requested', 'live_requested',
    ];
    if (ARR_QUERY_EDITABLE_STATUSES.includes(objInstance.strStatus)) {
      if (!bHasQueryEdit) {
        res.status(403).json({ bSuccess: false, strMessage: '이 단계에서는 쿼리 수정 권한(my_dashboard.query_edit)이 필요합니다.' });
        return;
      }
      if (req.body.strGeneratedQuery !== undefined) {
        objInstance.strGeneratedQuery = req.body.strGeneratedQuery;
        // 쿼리 수정 이력 추가
        const objActor = fnMakeActor(req);
        objInstance.arrStatusLogs.push({
          strStatus: objInstance.strStatus,
          strChangedBy: objActor.strDisplayName,
          nChangedByUserId: objActor.nUserId,
          strComment: 'DBA 쿼리 직접 수정',
          dtChangedAt: new Date().toISOString(),
        });
      }
      fnSaveEventInstances();
      fnBroadcastInstanceUpdate(objInstance);
      res.json({ bSuccess: true, objInstance });
      return;
    }

    // ── 일반 수정 (event_created): 생성자+my_dashboard.edit 또는 my_dashboard.edit_any
    if (objInstance.strStatus !== 'event_created') {
      res.status(400).json({ bSuccess: false, strMessage: '현재 상태에서는 수정할 수 없습니다.' });
      return;
    }

    const bIsCreator = objInstance.nCreatedByUserId === req.user?.nId;
    const bHasEdit = (arrUserPerms as string[]).includes('my_dashboard.edit');
    if (!bIsCreator && !bHasEditAny) {
      res.status(403).json({ bSuccess: false, strMessage: '본인이 생성한 이벤트만 수정할 수 있습니다. 타인 이벤트 수정은 my_dashboard.edit_any 권한이 필요합니다.' });
      return;
    }
    if (bIsCreator && !bHasEdit && !bHasEditAny) {
      res.status(403).json({ bSuccess: false, strMessage: '이벤트 수정 권한(my_dashboard.edit)이 필요합니다.' });
      return;
    }

    // 수정 가능한 단순 필드 업데이트
    const arrSimpleFields = ['strEventName', 'strServiceAbbr', 'strServiceRegion'];
    for (const key of arrSimpleFields) {
      if (req.body[key] !== undefined) {
        (objInstance as any)[key] = req.body[key];
      }
    }

    // 반영 범위 — event_created 상태에서만 수정 가능
    if (req.body.arrDeployScope !== undefined) {
      const arrAllowed = ['qa', 'live'];
      const arrNewScope: Array<'qa' | 'live'> = Array.isArray(req.body.arrDeployScope)
        ? req.body.arrDeployScope.filter((s: string) => arrAllowed.includes(s))
        : [];
      if (arrNewScope.length > 0) {
        objInstance.arrDeployScope = arrNewScope;
      }
    }

    // inputValues / dtDeployDate 실제 변경 시에만 쿼리 재생성 (값이 동일하면 GM이 수정한 쿼리 유지)
    const strNewInput = req.body.strInputValues;
    const strNewDate  = req.body.dtDeployDate;
    const bInputChanged =
      strNewInput !== undefined && String(strNewInput).trim() !== String(objInstance.strInputValues || '').trim();
    const bDateChanged =
      strNewDate !== undefined && String(strNewDate) !== String(objInstance.dtDeployDate || '');

    if (strNewInput !== undefined) objInstance.strInputValues = strNewInput;
    if (strNewDate !== undefined)  objInstance.dtDeployDate   = strNewDate;

    if (bInputChanged || bDateChanged) {
      const objTemplate = arrEvents.find((e) => e.nId === objInstance.nEventTemplateId);
      if (objTemplate) {
        const arrTemplates = objTemplate.arrQueryTemplates;
        if (Array.isArray(arrTemplates) && arrTemplates.length > 0) {
          objInstance.arrExecutionTargets = arrTemplates.map((qt) => ({
            nDbConnectionId: qt.nDbConnectionId,
            strQuery: fnApplyQueryTemplate(
              qt.strQueryTemplate,
              objInstance.strInputValues,
              objInstance.dtDeployDate,
              objInstance.strEventName,
              objInstance.strServiceAbbr,
              objInstance.strProductName,
              objInstance.strServiceRegion
            ),
          }));
          objInstance.strGeneratedQuery = objInstance.arrExecutionTargets.map((t) => t.strQuery).join('\n;\n');
        } else if (objTemplate.strQueryTemplate) {
          objInstance.strGeneratedQuery = fnApplyQueryTemplate(
            objTemplate.strQueryTemplate,
            objInstance.strInputValues,
            objInstance.dtDeployDate,
            objInstance.strEventName,
            objInstance.strServiceAbbr,
            objInstance.strProductName,
            objInstance.strServiceRegion
          );
          objInstance.arrExecutionTargets = undefined;
        }
      }
    }

    fnSaveEventInstances();
    fnBroadcastInstanceUpdate(objInstance);
    res.json({ bSuccess: true, objInstance });
  } catch (error) {
    console.error('이벤트 인스턴스 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
