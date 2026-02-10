import { Request, Response } from 'express';
import {
  arrEventInstances,
  fnGetNextInstanceId,
  TEventStatus,
} from '../data/eventInstances';

// 상태 전이 규칙: 현재 상태 → 다음 상태 (누가 할 수 있는지)
const objStatusTransitions: Record<string, { strNextStatus: TEventStatus; arrAllowedRoles: string[] }[]> = {
  event_created:  [{ strNextStatus: 'dba_confirmed',  arrAllowedRoles: ['dba', 'admin'] }],
  dba_confirmed:  [{ strNextStatus: 'qa_deployed',    arrAllowedRoles: ['dba', 'admin'] }],
  qa_deployed:    [{ strNextStatus: 'qa_verified',    arrAllowedRoles: ['gm', 'planner', 'admin'] }],
  qa_verified:    [{ strNextStatus: 'live_deployed',  arrAllowedRoles: ['dba', 'admin'] }],
  live_deployed:  [{ strNextStatus: 'live_verified',  arrAllowedRoles: ['gm', 'planner', 'admin'] }],
};

// 이벤트 인스턴스 생성 (운영자)
export const fnCreateInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nEventTemplateId, strEventLabel, strProductName,
      strServiceAbbr, strServiceRegion, strCategory, strType,
      strEventName, strInputValues, strGeneratedQuery, dtExecDate,
    } = req.body;

    if (!strEventName || !dtExecDate || !nEventTemplateId) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 입력해주세요.' });
      return;
    }

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
        strChangedBy: req.user?.strUserId || '',
        strComment: '이벤트 생성',
        dtChangedAt: new Date().toISOString(),
      }],
      strCreatedBy: req.body.strCreatedBy || req.user?.strUserId || '',
      nCreatedByUserId: req.user?.nId || 0,
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
    const strRole = req.user?.strRole || '';
    const nUserId = req.user?.nId || 0;
    const strFilter = req.query.filter as string || 'all';

    let arrFiltered = [...arrEventInstances];

    // 운영자: 본인이 생성한 것만
    if (strFilter === 'mine') {
      arrFiltered = arrFiltered.filter((e) => e.nCreatedByUserId === nUserId);
    }

    // DBA: 본인이 처리해야 할 것 (컨펌 대기, QA 배포 대기, LIVE 배포 대기)
    if (strFilter === 'dba_pending') {
      arrFiltered = arrFiltered.filter((e) =>
        e.strStatus === 'event_created' ||
        e.strStatus === 'dba_confirmed' ||
        e.strStatus === 'qa_verified'
      );
    }

    // 운영자: 본인이 확인해야 할 것 (QA 확인 대기, LIVE 확인 대기)
    if (strFilter === 'my_pending') {
      arrFiltered = arrFiltered.filter((e) =>
        e.nCreatedByUserId === nUserId &&
        (e.strStatus === 'qa_deployed' || e.strStatus === 'live_deployed')
      );
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

    // 전이 가능한 상태 확인
    const arrTransitions = objStatusTransitions[objInstance.strStatus] || [];
    const objTransition = arrTransitions.find((t) => t.strNextStatus === strNextStatus);

    if (!objTransition) {
      res.status(400).json({ bSuccess: false, strMessage: '해당 상태로 변경할 수 없습니다.' });
      return;
    }

    // 권한 확인
    if (!objTransition.arrAllowedRoles.includes(strRole)) {
      res.status(403).json({ bSuccess: false, strMessage: '해당 상태를 변경할 권한이 없습니다.' });
      return;
    }

    // 상태 변경
    objInstance.strStatus = strNextStatus;
    objInstance.arrStatusLogs.push({
      strStatus: strNextStatus,
      strChangedBy: req.user?.strUserId || '',
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
