import { Request, Response } from 'express';
import {
  arrEventInstances, fnGetNextInstanceId,
  TEventStatus, IStageActor,
} from '../data/eventInstances';

// 상태 전이 규칙 (9단계)
const objStatusTransitions: Record<string, { strNextStatus: TEventStatus; arrAllowedRoles: string[] }[]> = {
  event_created:      [{ strNextStatus: 'confirm_requested', arrAllowedRoles: ['gm', 'planner', 'admin'] }],
  confirm_requested:  [{ strNextStatus: 'dba_confirmed',     arrAllowedRoles: ['dba', 'admin'] }],
  dba_confirmed:      [{ strNextStatus: 'qa_requested',      arrAllowedRoles: ['gm', 'planner', 'admin'] }],
  qa_requested:       [{ strNextStatus: 'qa_deployed',       arrAllowedRoles: ['dba', 'admin'] }],
  qa_deployed:        [{ strNextStatus: 'qa_verified',       arrAllowedRoles: ['gm', 'planner', 'admin'] }],
  qa_verified:        [{ strNextStatus: 'live_requested',    arrAllowedRoles: ['gm', 'planner', 'admin'] }],
  live_requested:     [{ strNextStatus: 'live_deployed',     arrAllowedRoles: ['dba', 'admin'] }],
  live_deployed:      [{ strNextStatus: 'live_verified',     arrAllowedRoles: ['gm', 'planner', 'admin'] }],
};

// 현재 사용자 정보를 IStageActor로 변환
const fnMakeActor = (req: Request): IStageActor => ({
  strDisplayName: req.body.strActorName || req.user?.strUserId || '',
  nUserId: req.user?.nId || 0,
  strUserId: req.user?.strUserId || '',
  dtProcessedAt: new Date().toISOString(),
});

// 이벤트 인스턴스 생성
export const fnCreateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nEventTemplateId, strEventLabel, strProductName,
      strServiceAbbr, strServiceRegion, strCategory, strType,
      strEventName, strInputValues, strGeneratedQuery, dtExecDate,
      strCreatedBy,
    } = req.body;

    if (!strEventName || !dtExecDate || !nEventTemplateId) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

    const objCreator: IStageActor = {
      strDisplayName: strCreatedBy || req.user?.strUserId || '',
      nUserId: req.user?.nId || 0,
      strUserId: req.user?.strUserId || '',
      dtProcessedAt: new Date().toISOString(),
    };

    const objNew = {
      nId: fnGetNextInstanceId(),
      nEventTemplateId,
      strEventLabel: strEventLabel || '',
      strProductName: strProductName || '',
      strServiceAbbr: strServiceAbbr || '',
      strServiceRegion: strServiceRegion || '',
      strCategory: strCategory || '',
      strType: strType || '',
      strEventName,
      strInputValues: strInputValues || '',
      strGeneratedQuery: strGeneratedQuery || '',
      dtExecDate,
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

    // 내가 관여한 이벤트 (생성/컨펌/반영/확인 중 하나라도 내가 한 것)
    if (strFilter === 'involved') {
      arrFiltered = arrFiltered.filter((e) =>
        e.objCreator?.nUserId === nUserId ||
        e.objConfirmer?.nUserId === nUserId ||
        e.objQaDeployer?.nUserId === nUserId ||
        e.objQaVerifier?.nUserId === nUserId ||
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
      const strRole = req.user?.strRole || '';
      arrFiltered = arrFiltered.filter((e) => {
        const arrTrans = objStatusTransitions[e.strStatus] || [];
        return arrTrans.some((t) => t.arrAllowedRoles.includes(strRole));
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
    const strRole = req.user?.strRole || '';

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

    if (!objTransition.arrAllowedRoles.includes(strRole)) {
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

// 이벤트 인스턴스 수정 (event_created 상태에서만 가능, 생성자만)
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

    // 생성자 본인만 수정 가능
    if (objInstance.nCreatedByUserId !== req.user?.nId && req.user?.strRole !== 'admin') {
      res.status(403).json({ bSuccess: false, strMessage: '본인이 생성한 이벤트만 수정할 수 있습니다.' });
      return;
    }

    // 수정 가능한 필드만 업데이트
    const arrEditableFields = [
      'strEventName', 'strInputValues', 'strGeneratedQuery',
      'dtExecDate', 'strServiceAbbr', 'strServiceRegion',
    ];
    for (const key of arrEditableFields) {
      if (req.body[key] !== undefined) {
        (objInstance as any)[key] = req.body[key];
      }
    }

    res.json({ bSuccess: true, objInstance });
  } catch (error) {
    console.error('이벤트 인스턴스 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
