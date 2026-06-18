import type { IEventInstance, TEventStatus } from '../data/eventInstances';
import { fnShouldSkipEventInstanceProgressNotification } from './eventInstanceNotificationEligibility';
import {
  fnGetSlackWebhookUrl,
  fnIsSlackNotificationsEnabled,
  fnPostSlackIncomingWebhook,
  type TSlackWebhookChannel,
} from './slackIncomingWebhook';

const OBJ_STATUS_LABEL: Record<TEventStatus, string> = {
  event_created: '생성',
  qa_requested: 'QA 반영 요청',
  qa_deployed: 'QA 반영 실행',
  qa_verified: 'QA 확인',
  live_requested: 'LIVE 반영 요청',
  live_deployed: 'LIVE 반영 실행',
  live_verified: '완료',
};

/** DBA 채널 — 모든 프로덕트 QA·LIVE 반영 요청 */
const ARR_DBA_NOTIFY_STATUSES_DEFAULT: readonly TEventStatus[] = [
  'qa_requested',
  'live_requested',
];

/** 프로덕트 채널(MV/GZ/AD) — 해당 프로덕트 QA·LIVE 반영 완료 */
const ARR_PRODUCT_NOTIFY_STATUSES_DEFAULT: readonly TEventStatus[] = [
  'qa_deployed',
  'live_deployed',
];

const OBJ_DBA_SLACK_TITLE: Partial<Record<TEventStatus, string>> = {
  qa_requested: 'QA 반영 요청',
  live_requested: 'LIVE 반영 요청',
};

const OBJ_PRODUCT_SLACK_TITLE: Partial<Record<TEventStatus, string>> = {
  qa_deployed: 'QA 반영 완료',
  live_deployed: 'LIVE 반영 완료',
};

const fnGetStatusLabel = (strStatus: TEventStatus, bPermanentlyRemoved?: boolean): string => (
  bPermanentlyRemoved ? '영구 삭제' : (OBJ_STATUS_LABEL[strStatus] ?? strStatus)
);

const fnBuildPublicDashboardUrl = (nInstanceId: number): string | null => {
  const strBase = process.env.DQPM_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!strBase) return null;
  return `${strBase}/my-dashboard?nInstanceId=${nInstanceId}`;
};

const fnParseNotifyStatuses = (
  strEnvKey: string,
  arrDefault: readonly TEventStatus[],
): readonly TEventStatus[] => {
  const strRaw = process.env[strEnvKey]?.trim();
  if (!strRaw) return arrDefault;
  const arrParsed = strRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as TEventStatus[];
  return arrParsed.length > 0 ? arrParsed : arrDefault;
};

const fnParseDbaNotifyStatuses = (): readonly TEventStatus[] => (
  fnParseNotifyStatuses('SLACK_NOTIFY_DBA_STATUSES', ARR_DBA_NOTIFY_STATUSES_DEFAULT)
);

const fnParseProductNotifyStatuses = (): readonly TEventStatus[] => (
  fnParseNotifyStatuses('SLACK_NOTIFY_PRODUCT_STATUSES', ARR_PRODUCT_NOTIFY_STATUSES_DEFAULT)
);

export const fnShouldNotifySlackDbaChannel = (strStatus: TEventStatus): boolean => (
  fnParseDbaNotifyStatuses().includes(strStatus)
);

export const fnShouldNotifySlackProductChannel = (strStatus: TEventStatus): boolean => (
  fnParseProductNotifyStatuses().includes(strStatus)
);

/** 프로덕트 서비스 약어 → Slack 채널 (AD/G → ad, MV/KR → mv, SR → sr) */
export const fnResolveProductSlackChannel = (strServiceAbbr: string): TSlackWebhookChannel | null => {
  const strPrefix = strServiceAbbr.trim().toUpperCase().split('/')[0];
  if (strPrefix === 'MV') return 'mv';
  if (strPrefix === 'GZ') return 'gz';
  if (strPrefix === 'AD') return 'ad';
  if (strPrefix === 'SR') return 'sr';
  return null;
};

const fnGetSlackTitle = (strChannel: TSlackWebhookChannel, strStatus: TEventStatus): string => {
  if (strChannel === 'dba') {
    return OBJ_DBA_SLACK_TITLE[strStatus] ?? '이벤트 상태 변경';
  }
  return OBJ_PRODUCT_SLACK_TITLE[strStatus] ?? '이벤트 상태 변경';
};

export const fnBuildSlackInstancePayload = (
  strTitle: string,
  objInstance: Pick<
    IEventInstance,
    'nId' | 'strEventName' | 'strProductName' | 'strStatus' | 'bPermanentlyRemoved'
  >,
): Record<string, unknown> => {
  const strName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  const strStatusLabel = fnGetStatusLabel(objInstance.strStatus, objInstance.bPermanentlyRemoved);
  const strProduct = objInstance.strProductName ? ` · ${objInstance.strProductName}` : '';
  const strFallback = `${strTitle}: ${strName}${strProduct} → ${strStatusLabel}`;
  const strDashboardUrl = fnBuildPublicDashboardUrl(objInstance.nId);

  const arrBlocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: strTitle, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*이벤트*\n${strName}` },
        { type: 'mrkdwn', text: `*상태*\n${strStatusLabel}` },
        ...(objInstance.strProductName
          ? [{ type: 'mrkdwn', text: `*프로덕트*\n${objInstance.strProductName}` }]
          : []),
        { type: 'mrkdwn', text: `*ID*\n#${objInstance.nId}` },
      ],
    },
  ];

  if (strDashboardUrl) {
    arrBlocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '나의 대시보드에서 보기', emoji: true },
          url: strDashboardUrl,
        },
      ],
    });
  }

  return { text: strFallback, blocks: arrBlocks };
};

const fnSendSlackToChannel = (
  strChannel: TSlackWebhookChannel,
  strTitle: string,
  objInstance: Pick<
    IEventInstance,
    'nId' | 'strEventName' | 'strProductName' | 'strStatus' | 'bPermanentlyRemoved'
  >,
): void => {
  const strWebhookUrl = fnGetSlackWebhookUrl(strChannel);
  if (!strWebhookUrl) return;
  const objPayload = fnBuildSlackInstancePayload(strTitle, objInstance);
  void fnPostSlackIncomingWebhook(strWebhookUrl, objPayload);
};

const fnSendSlackForInstance = (objInstance: IEventInstance): void => {
  if (fnShouldNotifySlackDbaChannel(objInstance.strStatus)) {
    fnSendSlackToChannel(
      'dba',
      fnGetSlackTitle('dba', objInstance.strStatus),
      objInstance,
    );
  }
  const strProductChannel = fnResolveProductSlackChannel(objInstance.strServiceAbbr);
  if (
    strProductChannel
    && fnShouldNotifySlackProductChannel(objInstance.strStatus)
  ) {
    fnSendSlackToChannel(
      strProductChannel,
      fnGetSlackTitle(strProductChannel, objInstance.strStatus),
      objInstance,
    );
  }
};

export const fnNotifySlackInstanceCreated = (objInstance: IEventInstance): void => {
  if (!fnIsSlackNotificationsEnabled()) return;
  // 생성 직후는 event_created — DBA 요청 상태가 아니면 전송하지 않음
  fnSendSlackForInstance(objInstance);
};

export const fnNotifySlackInstanceUpdate = (
  objInstance: IEventInstance,
  bNotifyStatusProgress: boolean,
): void => {
  if (!fnIsSlackNotificationsEnabled()) return;
  if (fnShouldSkipEventInstanceProgressNotification(objInstance)) return;
  if (!bNotifyStatusProgress) return;
  fnSendSlackForInstance(objInstance);
};
