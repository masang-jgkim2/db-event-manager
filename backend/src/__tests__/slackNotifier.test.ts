import type { IEventInstance } from '../data/eventInstances';

const objBaseInstance = (): IEventInstance => ({
  nId: 42,
  nEventTemplateId: 1,
  nProductId: 1,
  strEventLabel: '테스트',
  strProductName: 'DK',
  strServiceAbbr: 'DK/KR',
  strServiceRegion: 'kr',
  strCategory: 'event',
  strType: 'default',
  strEventName: '테스트 이벤트',
  strInputValues: '{}',
  strGeneratedQuery: 'SELECT 1',
  dtDeployDate: '2026-01-01T00:00:00.000Z',
  arrDeployScope: ['qa'],
  strStatus: 'qa_requested',
  arrStatusLogs: [],
  objCreator: { strDisplayName: '운영', nUserId: 2, strUserId: 'ops', dtProcessedAt: '2026-01-01T00:00:00.000Z' },
  objConfirmer: null,
  objQaRequester: null,
  objQaDeployer: null,
  objQaVerifier: null,
  objLiveRequester: null,
  objLiveDeployer: null,
  objLiveVerifier: null,
  strCreatedBy: '운영',
  nCreatedByUserId: 2,
  dtCreatedAt: '2026-01-01T00:00:00.000Z',
});

const ARR_SLACK_WEBHOOK_ENV_KEYS = [
  'SLACK_WEBHOOK_URL_DBA',
  'SLACK_WEBHOOK_URL_GZ',
  'SLACK_WEBHOOK_URL_ND',
  'SLACK_WEBHOOK_URL_NX',
  'SLACK_WEBHOOK_URL_LH',
  'SLACK_WEBHOOK_URL_MV',
  'SLACK_WEBHOOK_URL_SR',
  'SLACK_WEBHOOK_URL_AD',
  'SLACK_WEBHOOK_URL_AO',
  'SLACK_WEBHOOK_URL_FH',
  'SLACK_WEBHOOK_URL_CC',
  'SLACK_WEBHOOK_URL_KR',
  'SLACK_WEBHOOK_URL_PT',
  'SLACK_WEBHOOK_URL_DK',
] as const;

describe('slackNotifier', () => {
  const fnOriginalFetch = global.fetch;
  let fnFetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fnFetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => 'ok' });
    global.fetch = fnFetchMock as typeof fetch;
    delete process.env.SLACK_NOTIFICATIONS_ENABLED;
    for (const strKey of ARR_SLACK_WEBHOOK_ENV_KEYS) {
      delete process.env[strKey];
    }
    delete process.env.SLACK_NOTIFY_DBA_STATUSES;
    delete process.env.SLACK_NOTIFY_PRODUCT_STATUSES;
    delete process.env.SLACK_NOTIFY_DBA_TEMPLATE_STATUSES;
    delete process.env.DQPM_PUBLIC_BASE_URL;
  });

  afterAll(() => {
    global.fetch = fnOriginalFetch;
  });

  it('SLACK_NOTIFICATIONS_ENABLED 가 아니면 전송하지 않는다', async () => {
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/test';
    const { fnNotifySlackInstanceCreated } = await import('../services/slackNotifier');
    fnNotifySlackInstanceCreated(objBaseInstance());
    expect(fnFetchMock).not.toHaveBeenCalled();
  });

  it('QA 반영 요청 시 DBA 채널로 Block Kit payload 를 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    process.env.DQPM_PUBLIC_BASE_URL = 'https://dqpm.example.com';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(objBaseInstance(), true);
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    const [, objInit] = fnFetchMock.mock.calls[0] as [string, RequestInit];
    expect(objInit.method).toBe('POST');
    const objBody = JSON.parse(String(objInit.body));
    expect(objBody.text).toContain('테스트 이벤트');
    expect(objBody.blocks?.[0]?.text?.text).toBe('QA 반영 요청');
    const objActions = objBody.blocks.find((b: { type: string }) => b.type === 'actions');
    expect(objActions.elements[0].url).toBe('https://dqpm.example.com/my-dashboard?nInstanceId=42');
  });

  it('bNotifyStatusProgress=false 면 DBA 쿼리 수정 등에서 Slack 을 보내지 않는다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(objBaseInstance(), false);
    expect(fnFetchMock).not.toHaveBeenCalled();
  });

  it('qa_verified 는 진행 알림 스킵 대상이라 Slack 을 보내지 않는다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    const objInstance = { ...objBaseInstance(), strStatus: 'qa_verified' as const };
    fnNotifySlackInstanceUpdate(objInstance, true);
    expect(fnFetchMock).not.toHaveBeenCalled();
  });

  it('기본값 — DBA: qa/live 요청, 프로덕트: qa/live 반영 완료', async () => {
    const {
      fnShouldNotifySlackDbaChannel,
      fnShouldNotifySlackProductChannel,
    } = await import('../services/slackNotifier');
    expect(fnShouldNotifySlackDbaChannel('qa_requested')).toBe(true);
    expect(fnShouldNotifySlackDbaChannel('live_requested')).toBe(true);
    expect(fnShouldNotifySlackDbaChannel('event_created')).toBe(false);
    expect(fnShouldNotifySlackDbaChannel('qa_deployed')).toBe(false);

    expect(fnShouldNotifySlackProductChannel('qa_deployed')).toBe(true);
    expect(fnShouldNotifySlackProductChannel('live_deployed')).toBe(true);
    expect(fnShouldNotifySlackProductChannel('qa_requested')).toBe(false);
  });

  it('이벤트 생성(event_created)만으로는 Slack 을 보내지 않는다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    const { fnNotifySlackInstanceCreated } = await import('../services/slackNotifier');
    fnNotifySlackInstanceCreated({ ...objBaseInstance(), strStatus: 'event_created' });
    expect(fnFetchMock).not.toHaveBeenCalled();
  });

  it('프로덕트 약어 접두사에 따라 GM 채널을 고른다', async () => {
    const { fnResolveProductSlackChannel } = await import('../services/slackNotifier');
    expect(fnResolveProductSlackChannel('GZ/KR')).toBe('gz');
    expect(fnResolveProductSlackChannel('ND/KR')).toBe('nd');
    expect(fnResolveProductSlackChannel('NX/KR')).toBe('nx');
    expect(fnResolveProductSlackChannel('LH/KR')).toBe('lh');
    expect(fnResolveProductSlackChannel('MV/KR')).toBe('mv');
    expect(fnResolveProductSlackChannel('SR')).toBe('sr');
    expect(fnResolveProductSlackChannel('AD/G')).toBe('ad');
    expect(fnResolveProductSlackChannel('AO/KR')).toBe('ao');
    expect(fnResolveProductSlackChannel('FH/KR')).toBe('fh');
    expect(fnResolveProductSlackChannel('CC/KR')).toBe('cc');
    expect(fnResolveProductSlackChannel('KR/KR')).toBe('kr');
    expect(fnResolveProductSlackChannel('PT/KR')).toBe('pt');
    expect(fnResolveProductSlackChannel('DK/KR')).toBe('dk');
    expect(fnResolveProductSlackChannel('DK/G')).toBe('dk');
    expect(fnResolveProductSlackChannel('UNKNOWN/KR')).toBeNull();
  });

  it('AD/G QA 반영 완료는 ad 프로덕트 채널만으로 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    process.env.SLACK_WEBHOOK_URL_AD = 'https://hooks.slack.com/services/ad';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(
      { ...objBaseInstance(), strServiceAbbr: 'AD/G', strStatus: 'qa_deployed' },
      true,
    );
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/ad');
    const objBody = JSON.parse(String((fnFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(objBody.blocks?.[0]?.text?.text).toBe('QA 반영 완료');
  });

  it('SR QA 반영 완료는 sr 프로덕트 채널로 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_SR = 'https://hooks.slack.com/services/sr';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(
      { ...objBaseInstance(), strServiceAbbr: 'SR', strStatus: 'live_deployed' },
      true,
    );
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/sr');
  });

  it('DK QA 반영 완료는 dk GM 채널로 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DK = 'https://hooks.slack.com/services/dk';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(
      { ...objBaseInstance(), strStatus: 'qa_deployed' },
      true,
    );
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/dk');
  });

  it('DK QA 반영 요청은 DBA 채널만으로 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    process.env.SLACK_WEBHOOK_URL_AD = 'https://hooks.slack.com/services/ad';
    const { fnNotifySlackInstanceUpdate } = await import('../services/slackNotifier');
    fnNotifySlackInstanceUpdate(objBaseInstance(), true);
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/dba');
  });

  it('쿼리 템플릿 confirm_requested 시 DBA 채널로 Block Kit payload 를 보낸다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    process.env.DQPM_PUBLIC_BASE_URL = 'https://dqpm.example.com';
    const { fnNotifySlackTemplateStatus } = await import('../services/slackNotifier');
    fnNotifySlackTemplateStatus({
      nId: 7,
      strEventLabel: '6월 이벤트 템플릿',
      strProductName: 'DK온라인',
      strStatus: 'confirm_requested',
    });
    expect(fnFetchMock).toHaveBeenCalledTimes(1);
    expect(fnFetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/dba');
    const objBody = JSON.parse(String((fnFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(objBody.blocks?.[0]?.text?.text).toBe('쿼리 리뷰 요청');
    const objActions = objBody.blocks.find((b: { type: string }) => b.type === 'actions');
    expect(objActions.elements[0].url).toBe('https://dqpm.example.com/events?nTemplateId=7');
  });

  it('쿼리 템플릿 dba_confirmed 는 Slack 을 보내지 않는다', async () => {
    process.env.SLACK_NOTIFICATIONS_ENABLED = '1';
    process.env.SLACK_WEBHOOK_URL_DBA = 'https://hooks.slack.com/services/dba';
    const { fnNotifySlackTemplateStatus } = await import('../services/slackNotifier');
    fnNotifySlackTemplateStatus({
      nId: 7,
      strEventLabel: '템플릿',
      strProductName: 'DK온라인',
      strStatus: 'dba_confirmed',
    });
    expect(fnFetchMock).not.toHaveBeenCalled();
  });
});
