import { Request, Response } from 'express';
import { z } from 'zod';
import {
  fnDeleteNotificationSubscription,
  fnListNotificationSubscriptionsByUserIds,
  fnUpsertNotificationSubscription,
} from '../data/notificationSubscriptions';
import {
  fnGetVapidPublicKey,
  fnIsUserWebPushEnabled,
  fnIsWebPushConfigured,
} from '../services/webPushService';

const objSubscribeSchema = z.object({
  objSubscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const objUnsubscribeSchema = z.object({
  strEndpoint: z.string().min(1),
});

/** GET /api/push/status — 구독·UI 설정·VAPID 진단(설정 화면용) */
export const fnGetPushStatus = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  const arrSubs = await fnListNotificationSubscriptionsByUserIds([nUserId]);
  res.json({
    bSuccess: true,
    bVapidConfigured: fnIsWebPushConfigured(),
    bUserPrefEnabled: fnIsUserWebPushEnabled(nUserId),
    nSubscriptionCount: arrSubs.length,
  });
};

export const fnGetPushVapidPublicKey = (_req: Request, res: Response): void => {
  if (!fnIsWebPushConfigured()) {
    res.json({ bSuccess: true, bEnabled: false, strPublicKey: null });
    return;
  }
  res.json({
    bSuccess: true,
    bEnabled: true,
    strPublicKey: fnGetVapidPublicKey(),
  });
};

export const fnPostPushSubscribe = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  if (!fnIsWebPushConfigured()) {
    res.status(503).json({ bSuccess: false, strMessage: 'Web Push가 서버에 설정되지 않았습니다.' });
    return;
  }
  const objParsed = objSubscribeSchema.safeParse(req.body);
  if (!objParsed.success) {
    res.status(400).json({ bSuccess: false, strMessage: '구독 정보가 올바르지 않습니다.' });
    return;
  }
  const { objSubscription } = objParsed.data;
  const objSaved = await fnUpsertNotificationSubscription({
    nUserId,
    strEndpoint: objSubscription.endpoint,
    strP256dh: objSubscription.keys.p256dh,
    strAuth: objSubscription.keys.auth,
    strUserAgent: req.headers['user-agent'] ?? null,
  });
  res.json({ bSuccess: true, objSubscription: { nId: objSaved.nId } });
};

export const fnDeletePushSubscribe = async (req: Request, res: Response): Promise<void> => {
  const nUserId = req.user?.nId ?? 0;
  if (nUserId <= 0) {
    res.status(401).json({ bSuccess: false, strMessage: '인증이 필요합니다.' });
    return;
  }
  const objParsed = objUnsubscribeSchema.safeParse(req.body);
  if (!objParsed.success) {
    res.status(400).json({ bSuccess: false, strMessage: 'strEndpoint가 필요합니다.' });
    return;
  }
  const bDeleted = await fnDeleteNotificationSubscription(nUserId, objParsed.data.strEndpoint);
  res.json({ bSuccess: true, bDeleted });
};
