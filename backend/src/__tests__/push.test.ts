import request from 'supertest';
import webpush from 'web-push';
import app from '../app';
import { fnInitUsers } from '../data/users';
import { fnSetUserUiPreferenceEntries } from '../data/userUiPreferences';
import { arrNotificationSubscriptions } from '../data/notificationSubscriptions';
import { STR_UI_WEB_PUSH_ENABLED } from '../services/webPushService';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const STR_TEST_PUBLIC_KEY = 'BIZ9kiTfPRFZxMbw0RfwbqH69JySCyITe6uP6vx8M6roELATABa9iRSOyD0gt380h4wBV2bTvzrxorhUEL5tBFA';
const STR_TEST_PRIVATE_KEY = 'gdc37ngRC382kC9C_p3VbdCHB9vhzyGaU36OIMN_2FE';
const OBJ_TEST_SUBSCRIPTION = {
  endpoint: 'https://push.example.test/subscription-1',
  keys: {
    p256dh: 'test-p256dh',
    auth: 'test-auth',
  },
};

const fnLoginAs = async (strUserId: string, strPassword: string): Promise<string> => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ strUserId, strPassword });
  expect(res.status).toBe(200);
  return res.body.strToken;
};

describe('Web Push API', () => {
  let strAdminToken: string;
  let strGmToken: string;
  let strDbaToken: string;

  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = STR_TEST_PUBLIC_KEY;
    process.env.VAPID_PRIVATE_KEY = STR_TEST_PRIVATE_KEY;
    process.env.VAPID_SUBJECT = 'mailto:dqpm@test.local';
    await fnInitUsers();
    strAdminToken = await fnLoginAs('admin', 'admin123');
    strGmToken = await fnLoginAs('gm01', 'gm123');
    strDbaToken = await fnLoginAs('dba01', 'dba123');
  });

  beforeEach(() => {
    arrNotificationSubscriptions.length = 0;
    jest.clearAllMocks();
  });

  it('GET /api/push/status → 구독·설정 진단', async () => {
    const res = await request(app)
      .get('/api/push/status')
      .set('Authorization', `Bearer ${strAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(res.body.bVapidConfigured).toBe(true);
    expect(typeof res.body.bUserPrefEnabled).toBe('boolean');
    expect(typeof res.body.nSubscriptionCount).toBe('number');
  });

  it('GET /api/push/vapid-public-key → bEnabled·공개키', async () => {
    const res = await request(app).get('/api/push/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(res.body.bEnabled).toBe(true);
    expect(res.body.strPublicKey).toBe(STR_TEST_PUBLIC_KEY);
  });

  it('POST /api/push/subscribe → 구독 저장', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${strAdminToken}`)
      .send({ objSubscription: OBJ_TEST_SUBSCRIPTION });
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(arrNotificationSubscriptions).toHaveLength(1);
    expect(arrNotificationSubscriptions[0].strEndpoint).toBe(OBJ_TEST_SUBSCRIPTION.endpoint);
  });

  it.each([
    ['gm01', 'strGmToken', 2, 'https://push.example.test/subscription-gm01'],
    ['dba01', 'strDbaToken', 3, 'https://push.example.test/subscription-dba01'],
  ] as const)('POST /api/push/subscribe → %s 계정 구독 저장', async (_strUserId, strTokenKey, nUserId, strEndpoint) => {
    const mapTokens = {
      strGmToken,
      strDbaToken,
    } as const;
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${mapTokens[strTokenKey]}`)
      .send({
        objSubscription: {
          ...OBJ_TEST_SUBSCRIPTION,
          endpoint: strEndpoint,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(arrNotificationSubscriptions.some((objSub) => objSub.nUserId === nUserId && objSub.strEndpoint === strEndpoint)).toBe(true);
  });

  it('DELETE /api/push/subscribe → 구독 삭제', async () => {
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${strAdminToken}`)
      .send({ objSubscription: OBJ_TEST_SUBSCRIPTION });
    const res = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${strAdminToken}`)
      .send({ strEndpoint: OBJ_TEST_SUBSCRIPTION.endpoint });
    expect(res.status).toBe(200);
    expect(res.body.bSuccess).toBe(true);
    expect(res.body.bDeleted).toBe(true);
    expect(arrNotificationSubscriptions).toHaveLength(0);
  });

  it('만료(410) 구독은 전송 시 정리', async () => {
    fnSetUserUiPreferenceEntries(1, { [STR_UI_WEB_PUSH_ENABLED]: '1' });
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${strAdminToken}`)
      .send({ objSubscription: OBJ_TEST_SUBSCRIPTION });
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({ statusCode: 410 });
    const { fnSendWebPushToUserIds } = await import('../services/webPushService');
    await fnSendWebPushToUserIds([1], {
      strTitle: '테스트',
      strBody: '본문',
    });
    expect(arrNotificationSubscriptions).toHaveLength(0);
  });
});
