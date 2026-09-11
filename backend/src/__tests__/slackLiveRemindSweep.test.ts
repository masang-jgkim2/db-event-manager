import type { IEventInstance } from '../data/eventInstances';

const objBase = (): Pick<
  IEventInstance,
  | 'bLiveSlackRemind'
  | 'dtSlackLiveRemindedAt'
  | 'strStatus'
  | 'bPermanentlyRemoved'
  | 'dtQaDeployDate'
  | 'dtLiveDeployDate'
  | 'dtDeployDate'
> => ({
  bLiveSlackRemind: true,
  strStatus: 'live_requested',
  dtLiveDeployDate: '2026-09-11T12:00:00.000Z',
  dtDeployDate: '2026-09-11T12:00:00.000Z',
});

describe('slackLiveRemindSweep', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.SLACK_NOTIFICATIONS_ENABLED;
    delete process.env.SLACK_REMINDERS_ENABLED;
    delete process.env.SLACK_LIVE_REMIND_MINUTES;
  });

  it('live_requested + 옵트인 + T−10 이내면 대상', async () => {
    const { fnShouldSendLiveSlackRemind } = await import('../services/slackLiveRemindSweep');
    const dtNow = new Date('2026-09-11T11:51:00.000Z'); // 9분 전
    expect(fnShouldSendLiveSlackRemind(objBase(), dtNow)).toBe(true);
  });

  it('T−10 이전이면 대상 아님', async () => {
    const { fnShouldSendLiveSlackRemind } = await import('../services/slackLiveRemindSweep');
    const dtNow = new Date('2026-09-11T11:49:00.000Z'); // 11분 전
    expect(fnShouldSendLiveSlackRemind(objBase(), dtNow)).toBe(false);
  });

  it('이미 발송했거나 옵트인 아니면 대상 아님', async () => {
    const { fnShouldSendLiveSlackRemind } = await import('../services/slackLiveRemindSweep');
    const dtNow = new Date('2026-09-11T11:55:00.000Z');
    expect(fnShouldSendLiveSlackRemind({ ...objBase(), bLiveSlackRemind: false }, dtNow)).toBe(false);
    expect(fnShouldSendLiveSlackRemind({
      ...objBase(),
      dtSlackLiveRemindedAt: '2026-09-11T11:50:00.000Z',
    }, dtNow)).toBe(false);
  });

  it('qa_requested 등 live_requested 이전이면 대상 아님', async () => {
    const { fnShouldSendLiveSlackRemind } = await import('../services/slackLiveRemindSweep');
    const dtNow = new Date('2026-09-11T11:55:00.000Z');
    expect(fnShouldSendLiveSlackRemind({ ...objBase(), strStatus: 'qa_requested' }, dtNow)).toBe(false);
  });

  it('미리알림 Slack 제목에 (미리 알림) 접두사를 붙이고 DBA만 전송', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    process.env.SLACK_WEBHOOK_URL_DK = 'https://hooks.slack.com/services/dk';
    process.env.DQPM_PUBLIC_BASE_URL = 'https://dqpm.example.com';
    const fnFetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
    global.fetch = fnFetchMock as typeof fetch;
    const { fnNotifySlackLiveRemind } = await import('../services/slackNotifier');
    fnNotifySlackLiveRemind({
      nId: 99,
      nEventTemplateId: 1,
      nProductId: 1,
      strEventLabel: 't',
      strProductName: 'DK',
      strServiceAbbr: 'DK/KR',
      strServiceRegion: 'kr',
      strCategory: 'event',
      strType: 'default',
      strEventName: '미리알림 테스트',
      strInputValues: '{}',
      strGeneratedQuery: 'SELECT 1',
      dtDeployDate: '2026-09-11T12:00:00.000Z',
      dtLiveDeployDate: '2026-09-11T12:00:00.000Z',
      arrDeployScope: ['live'],
      strStatus: 'live_requested',
      arrStatusLogs: [],
      objCreator: null,
      objConfirmer: null,
      objQaRequester: null,
      objQaDeployer: null,
      objQaVerifier: null,
      objLiveRequester: null,
      objLiveDeployer: null,
      objLiveVerifier: null,
      strCreatedBy: 'ops',
      nCreatedByUserId: 1,
      dtCreatedAt: '2026-09-11T00:00:00.000Z',
      bLiveSlackRemind: true,
    });
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/dba');
    const objBody = JSON.parse(String((fnFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(objBody.blocks?.[0]?.text?.text).toBe('(미리 알림) LIVE 반영 요청');
  });
});
