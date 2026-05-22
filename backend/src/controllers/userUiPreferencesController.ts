import { Request, Response } from 'express';
import { fnGetUserUiPreferenceEntries, fnSetUserUiPreferenceEntries } from '../data/userUiPreferences';

/** GET /api/auth/ui-preferences — 계정별 UI 로컬 설정 동기화(서버 → 클라이언트) */
export const fnGetUserUiPreferences = (req: Request, res: Response): void => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  const objEntries = fnGetUserUiPreferenceEntries(nUserId);
  res.json({ bSuccess: true, objEntries });
};

/** PUT /api/auth/ui-preferences — 계정별 UI 로컬 설정 동기화(클라이언트 → 서버) */
export const fnPutUserUiPreferences = (req: Request, res: Response): void => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  const objBody = req.body as { objEntries?: unknown };
  const objIn = objBody?.objEntries;
  if (!objIn || typeof objIn !== 'object' || Array.isArray(objIn)) {
    res.status(400).json({ bSuccess: false, strMessage: 'objEntries 객체가 필요합니다.' });
    return;
  }
  const objEntries: Record<string, string> = {};
  for (const [strK, val] of Object.entries(objIn as Record<string, unknown>)) {
    if (typeof val === 'string') objEntries[strK] = val;
  }
  fnSetUserUiPreferenceEntries(nUserId, objEntries);
  res.json({ bSuccess: true });
};
