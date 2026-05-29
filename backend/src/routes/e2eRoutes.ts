import { Router, type Request, type Response } from 'express';
import { fnReloadEventInstancesFromMysql } from '../data/bootstrapDataStore';

const router = Router();

const fnE2eReloadAllowed = (): boolean =>
  process.env.NODE_ENV !== 'production'
  && (process.env.E2E_ALLOW_RELOAD === '1' || process.env.E2E_ALLOW_RELOAD === 'true');

/** POST /api/e2e/reload-instances — seed 후 인메모리 동기화 (로컬·E2E 전용) */
router.post('/reload-instances', async (req: Request, res: Response): Promise<void> => {
  if (!fnE2eReloadAllowed()) {
    res.status(404).json({ bSuccess: false, strMessage: 'Not found' });
    return;
  }
  const strKey = (process.env.E2E_RELOAD_KEY || 'local-e2e').trim();
  if ((req.header('x-e2e-reload-key') || '') !== strKey) {
    res.status(403).json({ bSuccess: false, strMessage: 'Forbidden' });
    return;
  }
  try {
    const nCount = await fnReloadEventInstancesFromMysql();
    res.json({ bSuccess: true, nEventInstances: nCount });
  } catch (err: unknown) {
    console.error('[e2e] reload-instances 실패', err);
    res.status(500).json({ bSuccess: false, strMessage: 'reload failed' });
  }
});

export default router;
