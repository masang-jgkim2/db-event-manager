import type { IEventTemplate, TTemplateStatus } from '../data/events';
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

/** 프로덕트 GM 채널 — 해당 프로덕트 QA·LIVE 반영 완료 */
const ARR_PRODUCT_NOTIFY_STATUSES_DEFAULT: readonly TEventStatus[] = [
  'qa_deployed',
  'live_deployed',
];

/** DBA 채널 — 쿼리 템플릿 리뷰 요청 */
const ARR_DBA_TEMPLATE_NOTIFY_STATUSES_DEFAULT: readonly TTemplateStatus[] = [
  'confirm_requested',
];

const OBJ_TEMPLATE_STATUS_LABEL: Record<TTemplateStatus, string> = {
  template_created: '등록',
  confirm_requested: '쿼리 리뷰 요청',
  dba_confirmed: 'DBA 리뷰 완료',
};

const OBJ_TEMPLATE_DBA_SLACK_TITLE: Partial<Record<TTemplateStatus, string>> = {
  confirm_requested: '쿼리 리뷰 요청',
};

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

const fnBuildPublicTemplateUrl = (nTemplateId: number): string | null => {
  const strBase = process.env.DQPM_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!strBase) return null;
  return `${strBase}/events?nTemplateId=${nTemplateId}`;
};

const fnParseNotifyStatuses = <T extends string>(
  strEnvKey: string,
  arrDefault: readonly T[],
): readonly T[] => {
  const strRaw = process.env[strEnvKey]?.trim();
  if (!strRaw) return arrDefault;
  const arrParsed = strRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as T[];
  return arrParsed.length > 0 ? arrParsed : arrDefault;
};

const fnParseDbaNotifyStatuses = (): readonly TEventStatus[] => (
  fnParseNotifyStatuses('SLACK_NOTIFY_DBA_STATUSES', ARR_DBA_NOTIFY_STATUSES_DEFAULT)
);

const fnParseProductNotifyStatuses = (): readonly TEventStatus[] => (
  fnParseNotifyStatuses('SLACK_NOTIFY_PRODUCT_STATUSES', ARR_PRODUCT_NOTIFY_STATUSES_DEFAULT)
);

const fnParseDbaTemplateNotifyStatuses = (): readonly TTemplateStatus[] => (
  fnParseNotifyStatuses('SLACK_NOTIFY_DBA_TEMPLATE_STATUSES', ARR_DBA_TEMPLATE_NOTIFY_STATUSES_DEFAULT)
);

export const fnShouldNotifySlackDbaChannel = (strStatus: TEventStatus): boolean => (
  fnParseDbaNotifyStatuses().includes(strStatus)
);

export const fnShouldNotifySlackProductChannel = (strStatus: TEventStatus): boolean => (
  fnParseProductNotifyStatuses().includes(strStatus)
);

export const fnShouldNotifySlackDbaTemplateChannel = (strStatus: TTemplateStatus): boolean => (
  fnParseDbaTemplateNotifyStatuses().includes(strStatus)
);

/** strServiceAbbr 접두사 → GM Slack 채널 (예: AD/G → ad, DK/KR → dk) */
const MAP_SERVICE_PREFIX_TO_SLACK_CHANNEL: Record<string, TSlackWebhookChannel> = {
  GZ: 'gz',
  ND: 'nd',
  NX: 'nx',
  LH: 'lh',
  MV: 'mv',
  SR: 'sr',
  AD: 'ad',
  AO: 'ao',
  FH: 'fh',
  CC: 'cc',
  KR: 'kr',
  PT: 'pt',
  DK: 'dk',
};

export const fnResolveProductSlackChannel = (strServiceAbbr: string): TSlackWebhookChannel | null => {
  const strPrefix = strServiceAbbr.trim().toUpperCase().split('/')[0];
  if (!strPrefix) return null;
  return MAP_SERVICE_PREFIX_TO_SLACK_CHANNEL[strPrefix] ?? null;
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

export const fnBuildSlackTemplatePayload = (
  strTitle: string,
  objTpl: Pick<IEventTemplate, 'nId' | 'strEventLabel' | 'strProductName' | 'strStatus'>,
): Record<string, unknown> => {
  const strName = objTpl.strEventLabel?.trim() || `템플릿 #${objTpl.nId}`;
  const strStatusLabel = OBJ_TEMPLATE_STATUS_LABEL[objTpl.strStatus] ?? objTpl.strStatus;
  const strProduct = objTpl.strProductName ? ` · ${objTpl.strProductName}` : '';
  const strFallback = `${strTitle}: ${strName}${strProduct} → ${strStatusLabel}`;
  const strTemplateUrl = fnBuildPublicTemplateUrl(objTpl.nId);

  const arrBlocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: strTitle, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*템플릿*\n${strName}` },
        { type: 'mrkdwn', text: `*상태*\n${strStatusLabel}` },
        ...(objTpl.strProductName
          ? [{ type: 'mrkdwn', text: `*프로덕트*\n${objTpl.strProductName}` }]
          : []),
        { type: 'mrkdwn', text: `*ID*\n#${objTpl.nId}` },
      ],
    },
  ];

  if (strTemplateUrl) {
    arrBlocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '쿼리 템플릿에서 보기', emoji: true },
          url: strTemplateUrl,
        },
      ],
    });
  }

  return { text: strFallback, blocks: arrBlocks };
};

const fnPostSlackPayloadToChannel = (
  strChannel: TSlackWebhookChannel,
  objPayload: Record<string, unknown>,
): void => {
  const strWebhookUrl = fnGetSlackWebhookUrl(strChannel);
  if (!strWebhookUrl) return;
  void fnPostSlackIncomingWebhook(strWebhookUrl, objPayload);
};

const fnSendSlackToChannel = (
  strChannel: TSlackWebhookChannel,
  strTitle: string,
  objInstance: Pick<
    IEventInstance,
    'nId' | 'strEventName' | 'strProductName' | 'strStatus' | 'bPermanentlyRemoved'
  >,
): void => {
  const objPayload = fnBuildSlackInstancePayload(strTitle, objInstance);
  fnPostSlackPayloadToChannel(strChannel, objPayload);
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

/** 쿼리 템플릿 confirm_requested 등 — DBA Slack 채널 */
export const fnNotifySlackTemplateStatus = (
  objTpl: Pick<IEventTemplate, 'nId' | 'strEventLabel' | 'strProductName' | 'strStatus'>,
): void => {
  if (!fnIsSlackNotificationsEnabled()) return;
  if (!fnShouldNotifySlackDbaTemplateChannel(objTpl.strStatus)) return;
  const strTitle = OBJ_TEMPLATE_DBA_SLACK_TITLE[objTpl.strStatus] ?? '쿼리 템플릿 상태 변경';
  const objPayload = fnBuildSlackTemplatePayload(strTitle, objTpl);
  fnPostSlackPayloadToChannel('dba', objPayload);
};
