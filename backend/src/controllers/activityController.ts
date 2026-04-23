import { Request, Response } from 'express';
import {
  fnClearAllActivityLogs,
  fnListDistinctActivityActors,
  fnQueryActivityLogs,
  type TActivityCategory,
} from '../data/activityLogs';
import { fnBroadcastActivityLogsCleared } from '../services/sseBroadcaster';

const ARR_VALID: Array<'all' | TActivityCategory> = ['all', 'auth', 'event', 'user', 'ops', 'other'];

// GET /api/activity/logs — 활동 목록 (activity.view)
export const fnGetActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const strCategoryRaw = typeof req.query.strCategory === 'string' ? req.query.strCategory : 'all';
    const strCategory = ARR_VALID.includes(strCategoryRaw as 'all' | TActivityCategory)
      ? (strCategoryRaw as 'all' | TActivityCategory)
      : 'all';

    const nLimit = Math.min(500, Math.max(1, Number(req.query.nLimit) || 100));
    const nOffset = Math.max(0, Number(req.query.nOffset) || 0);

    const strDtFrom = typeof req.query.strDtFrom === 'string' && req.query.strDtFrom.trim()
      ? req.query.strDtFrom.trim()
      : undefined;
    const strDtTo = typeof req.query.strDtTo === 'string' && req.query.strDtTo.trim()
      ? req.query.strDtTo.trim()
      : undefined;
    const strMethod = typeof req.query.strMethod === 'string' && req.query.strMethod.trim()
      ? req.query.strMethod.trim()
      : undefined;
    const strActor = typeof req.query.strActor === 'string' ? req.query.strActor : undefined;
    const strActorNoneRaw = req.query.actorNone;
    const bActorNone =
      strActorNoneRaw === '1'
      || strActorNoneRaw === 'true'
      || String(strActorNoneRaw) === '1';
    const nActorEqRaw = req.query.nActorUserId;
    const nActorUserIdEq =
      nActorEqRaw !== undefined && nActorEqRaw !== ''
        ? Number(nActorEqRaw)
        : undefined;
    const nActorFiltered =
      nActorUserIdEq != null && !Number.isNaN(nActorUserIdEq) ? nActorUserIdEq : undefined;
    const strActorUserIdEq =
      typeof req.query.strActorUserId === 'string' && req.query.strActorUserId.length > 0
        ? req.query.strActorUserId
        : undefined;
    const nStatusRaw = req.query.nStatusCode;
    const nStatusCode =
      nStatusRaw !== undefined && nStatusRaw !== ''
        ? Number(nStatusRaw)
        : undefined;
    const nStatusFiltered =
      nStatusCode != null && !Number.isNaN(nStatusCode) ? nStatusCode : undefined;

    const { arrRows, nTotal } = fnQueryActivityLogs({
      strCategory,
      nLimit,
      nOffset,
      strDtFrom,
      strDtTo,
      strMethod,
      strActor,
      bActorNone: Boolean(bActorNone),
      nActorUserIdEq: nActorFiltered,
      strActorUserIdEq,
      nStatusCode: nStatusFiltered,
    });
    res.json({ bSuccess: true, arrLogs: arrRows, nTotal });
  } catch (error) {
    console.error('활동 로그 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// DELETE /api/activity/logs — 활동 로그 전체 초기화 (activity.clear)
export const fnDeleteActivityLogs = async (_req: Request, res: Response): Promise<void> => {
  try {
    fnClearAllActivityLogs();
    fnBroadcastActivityLogsCleared();
    console.log('[activityController] 활동 로그 전체 초기화 완료');
    res.json({ bSuccess: true, strMessage: '활동 로그를 모두 삭제했습니다.' });
  } catch (error) {
    console.error('[activityController] 활동 로그 초기화 오류 |', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// GET /api/activity/actors — 로그에 나온 행위자 목록 (activity.view)
export const fnGetActivityActors = async (_req: Request, res: Response): Promise<void> => {
  try {
    const arrActors = fnListDistinctActivityActors();
    res.json({ bSuccess: true, arrActors });
  } catch (error) {
    console.error('[activityController] 행위자 목록 오류 |', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
