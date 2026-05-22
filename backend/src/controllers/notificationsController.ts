import { Request, Response } from 'express';
import { z } from 'zod';
import {
  fnIsInAppNotificationsPersisted,
  fnListUserNotifications,
  fnMarkAllUserNotificationsRead,
  fnMarkUserNotificationRead,
} from '../data/userNotifications';
import { fnNotifyInAppFromClient } from '../services/inAppNotificationNotifier';

const objNotificationInputSchema = z.object({
  strLevel: z.enum(['success', 'error', 'warning', 'info']),
  strTitle: z.string().min(1),
  strBody: z.string().optional(),
  strRoute: z.string().optional(),
  objQuery: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  strSource: z.string().optional(),
});

export const fnGetNotifications = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  const bPersisted = fnIsInAppNotificationsPersisted();
  if (!bPersisted) {
    res.json({ bSuccess: true, bPersisted: false, arrNotifications: [] });
    return;
  }
  const arrNotifications = await fnListUserNotifications(nUserId);
  res.json({ bSuccess: true, bPersisted: true, arrNotifications });
};

export const fnPostNotification = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  if (!fnIsInAppNotificationsPersisted()) {
    res.status(503).json({ bSuccess: false, strMessage: '인앱 알림 서버 저장은 MySQL 모드에서만 지원합니다.' });
    return;
  }
  const objParsed = objNotificationInputSchema.safeParse(req.body);
  if (!objParsed.success) {
    res.status(400).json({ bSuccess: false, strMessage: '알림 정보가 올바르지 않습니다.' });
    return;
  }
  const objSaved = await fnNotifyInAppFromClient(nUserId, objParsed.data);
  if (!objSaved) {
    res.status(500).json({ bSuccess: false, strMessage: '알림 저장에 실패했습니다.' });
    return;
  }
  res.json({ bSuccess: true, objNotification: objSaved });
};

export const fnPatchNotificationRead = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  if (!fnIsInAppNotificationsPersisted()) {
    res.status(503).json({ bSuccess: false, strMessage: '인앱 알림 서버 저장은 MySQL 모드에서만 지원합니다.' });
    return;
  }
  const strId = String(req.params.strId ?? '').trim();
  if (!strId) {
    res.status(400).json({ bSuccess: false, strMessage: 'strId가 필요합니다.' });
    return;
  }
  const bUpdated = await fnMarkUserNotificationRead(nUserId, strId);
  res.json({ bSuccess: true, bUpdated });
};

export const fnPatchNotificationsReadAll = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  if (!fnIsInAppNotificationsPersisted()) {
    res.status(503).json({ bSuccess: false, strMessage: '인앱 알림 서버 저장은 MySQL 모드에서만 지원합니다.' });
    return;
  }
  await fnMarkAllUserNotificationsRead(nUserId);
  res.json({ bSuccess: true });
};
