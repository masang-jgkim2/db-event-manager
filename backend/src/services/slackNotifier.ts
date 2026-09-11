import type { IEventTemplate, TTemplateStatus } from '../data/events';
import type { IEventInstance, TEventStatus } from '../data/eventInstances';
import { fnShouldSkipEventInstanceProgressNotification } from './eventInstanceNotificationEligibility';
import {
  fnGetSlackWebhookUrl,
  fnIsSlackNotificationsEnabled,
  fnPostSlackIncomingWebhook,
  type TSlackProductChannel,
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

const ARR_DBA_NOTIFY_STATUSES_DEFAULT: readonly TEventStatus[] = [
  'qa_requested',
  'live_requested',
];

const ARR_PRODUCT_NOTIFY_STATUSES_DEFAULT: readonly TEventStatus[] = [
  'qa_deployed',
  'live_deployed',
];

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

/** strServiceAbbr 접두사 → GM Slack 채널 (예: AD/G → ad, DK/KR → dk) */
const MAP_SERVICE_PREFIX_TO_SLACK_CHANNEL: Record<string, TSlackProductChannel> = {
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

const fnTrimPublicBaseUrl = (strRaw?: string): string | null => {
  const strBase = strRaw?.trim().replace(/\/$/, '');
  return strBase || null;
};

/** 공통 fallback — 템플릿 알림 등 환경 구분 없는 링크 */
const fnGetPublicBaseUrl = (): string | null => (
  fnTrimPublicBaseUrl(process.env.DQPM_PUBLIC_BASE_URL)
);

/** 인스턴스 상태별 대시보드 링크 — QA/LIVE EC2가 같은 webhook을 쓰거나 env가 하나만 있을 때도 올바른 호스트 */
export const fnGetPublicBaseUrlForInstanceStatus = (strStatus: TEventStatus): string | null => {
  const strDefault = fnTrimPublicBaseUrl(process.env.DQPM_PUBLIC_BASE_URL);
  const strQa = fnTrimPublicBaseUrl(process.env.DQPM_PUBLIC_BASE_URL_QA);
  const strLive = fnTrimPublicBaseUrl(process.env.DQPM_PUBLIC_BASE_URL_LIVE);

  if (strStatus.startsWith('qa_')) return strQa || strDefault || null;
  if (strStatus.startsWith('live_')) return strLive || strDefault || null;
  return strDefault || strQa || strLive || null;
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

export const fnResolveProductSlackChannel = (strServiceAbbr: string): TSlackProductChannel | null => {
  const strPrefix = strServiceAbbr.trim().toUpperCase().split('/')[0];
  if (!strPrefix) return null;
  return MAP_SERVICE_PREFIX_TO_SLACK_CHANNEL[strPrefix] ?? null;
};

const fnGetInstanceSlackTitle = (strChannel: TSlackWebhookChannel, strStatus: TEventStatus): string => {
  if (strChannel === 'dba') {
    return OBJ_DBA_SLACK_TITLE[strStatus] ?? '이벤트 상태 변경';
  }
  return OBJ_PRODUCT_SLACK_TITLE[strStatus] ?? '이벤트 상태 변경';
};

type TSlackBlockKitOpts = {
  strTitle: string;
  /** 본문 한 줄 mrkdwn */
  strSummaryMrkdwn: string;
  /** 알림 배지·fallback 용 */
  strFallbackDetail: string;
  strButtonText?: string;
  strButtonUrl?: string | null;
};

/** Slack mrkdwn 예약문자 — 이벤트명·프로덕트에 <>& 가 있으면 깨짐 */
const fnEscapeSlackMrkdwn = (strRaw: string): string =>
  strRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Asia/Seoul YYYY-MM-DD HH:mm — 없거나 무효면 null */
export const fnFormatSlackDateTimeKst = (strIso?: string): string | null => {
  const strTrim = (strIso ?? '').trim();
  if (!strTrim) return null;
  const dt = new Date(strTrim);
  if (Number.isNaN(dt.getTime())) return null;
  const strFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
  // en-CA: YYYY-MM-DD, HH:mm → YYYY-MM-DD HH:mm
  return strFmt.replace(', ', ' ');
};

/** 상태 구간에 맞는 반영 예정 ISO */
export const fnResolveSlackDeployAtIso = (
  objInstance: Pick<IEventInstance, 'strStatus' | 'dtQaDeployDate' | 'dtLiveDeployDate' | 'dtDeployDate'>,
): string | undefined => {
  if (objInstance.strStatus.startsWith('qa_')) {
    return objInstance.dtQaDeployDate || undefined;
  }
  if (objInstance.strStatus.startsWith('live_')) {
    return objInstance.dtLiveDeployDate || objInstance.dtDeployDate || undefined;
  }
  return objInstance.dtQaDeployDate || objInstance.dtLiveDeployDate || objInstance.dtDeployDate || undefined;
};

const fnJoinSlackSummaryParts = (arrParts: string[]): string =>
  arrParts.filter((s) => s.trim().length > 0).join(' · ');

/** 인스턴스 본문: 값만 · 연결 (이벤트 번호 · 이벤트명 · 서비스 · 상태 · 반영 예정 시각) */
export const fnBuildSlackInstanceSummaryMrkdwn = (
  objInstance: Pick<
    IEventInstance,
    | 'nId'
    | 'strEventName'
    | 'strServiceAbbr'
    | 'strStatus'
    | 'bPermanentlyRemoved'
    | 'dtQaDeployDate'
    | 'dtLiveDeployDate'
    | 'dtDeployDate'
  >,
): string => {
  const strEventName = (objInstance.strEventName || `이벤트 #${objInstance.nId}`).trim();
  const strService = (objInstance.strServiceAbbr ?? '').trim();
  const strStatus = objInstance.bPermanentlyRemoved
    ? '영구 삭제'
    : (OBJ_STATUS_LABEL[objInstance.strStatus] ?? objInstance.strStatus);
  const strDeployAt = fnFormatSlackDateTimeKst(fnResolveSlackDeployAtIso(objInstance)) ?? '즉시 가능';
  // 라벨 없이 값만 · 로 연결 (이벤트 번호 · 이벤트명 · 서비스 · 상태 · 반영 예정 시각)
  return fnJoinSlackSummaryParts([
    `#${objInstance.nId}`,
    fnEscapeSlackMrkdwn(strEventName),
    strService ? fnEscapeSlackMrkdwn(strService) : '',
    fnEscapeSlackMrkdwn(strStatus),
    fnEscapeSlackMrkdwn(strDeployAt),
  ]);
};

/** 템플릿 본문: 값만 · 연결 (이벤트 번호 · 프로덕트 · 이벤트명 · 서비스 · 상태) */
export const fnBuildSlackTemplateSummaryMrkdwn = (
  objTpl: Pick<IEventTemplate, 'nId' | 'strEventLabel' | 'strProductName' | 'strStatus'> & {
    strServiceAbbr?: string;
  },
): string => {
  const strEventName = (objTpl.strEventLabel?.trim() || `템플릿 #${objTpl.nId}`);
  const strProduct = (objTpl.strProductName ?? '').trim();
  const strService = (objTpl.strServiceAbbr ?? '').trim();
  const strStatus = OBJ_TEMPLATE_STATUS_LABEL[objTpl.strStatus] ?? objTpl.strStatus;
  return fnJoinSlackSummaryParts([
    `#${objTpl.nId}`,
    strProduct ? fnEscapeSlackMrkdwn(strProduct) : '',
    fnEscapeSlackMrkdwn(strEventName),
    strService ? fnEscapeSlackMrkdwn(strService) : '',
    fnEscapeSlackMrkdwn(strStatus),
  ]);
};

const fnBuildSlackBlockKitPayload = (objOpts: TSlackBlockKitOpts): Record<string, unknown> => {
  const strFallback = `${objOpts.strTitle}: ${objOpts.strFallbackDetail}`;
  const arrBlocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: objOpts.strTitle, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: objOpts.strSummaryMrkdwn },
    },
  ];
  if (objOpts.strButtonText && objOpts.strButtonUrl) {
    arrBlocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: objOpts.strButtonText, emoji: true },
          url: objOpts.strButtonUrl,
        },
      ],
    });
  }
  return { text: strFallback, blocks: arrBlocks };
};

type TSlackInstanceFields = Pick<
  IEventInstance,
  | 'nId'
  | 'strEventName'
  | 'strProductName'
  | 'strServiceAbbr'
  | 'strStatus'
  | 'bPermanentlyRemoved'
  | 'dtQaDeployDate'
  | 'dtLiveDeployDate'
  | 'dtDeployDate'
>;

export const fnBuildSlackInstancePayload = (
  strTitle: string,
  objInstance: TSlackInstanceFields,
): Record<string, unknown> => {
  const strBase = fnGetPublicBaseUrlForInstanceStatus(objInstance.strStatus);
  const strEventName = objInstance.strEventName || `이벤트 #${objInstance.nId}`;
  return fnBuildSlackBlockKitPayload({
    strTitle,
    strSummaryMrkdwn: fnBuildSlackInstanceSummaryMrkdwn(objInstance),
    strFallbackDetail: `#${objInstance.nId} · ${strEventName}`,
    // DBA·프로덕트 채널 공통 — QA/LIVE 반영 요청·완료 모두 나의 대시보드
    strButtonText: '나의 대시보드에서 보기',
    strButtonUrl: strBase ? `${strBase}/my-dashboard?nInstanceId=${objInstance.nId}` : null,
  });
};

export const fnBuildSlackTemplatePayload = (
  strTitle: string,
  objTpl: Pick<IEventTemplate, 'nId' | 'strEventLabel' | 'strProductName' | 'strStatus'> & {
    strServiceAbbr?: string;
  },
): Record<string, unknown> => {
  const strBase = fnGetPublicBaseUrl();
  const strEventName = objTpl.strEventLabel?.trim() || `템플릿 #${objTpl.nId}`;
  return fnBuildSlackBlockKitPayload({
    strTitle,
    strSummaryMrkdwn: fnBuildSlackTemplateSummaryMrkdwn(objTpl),
    strFallbackDetail: `#${objTpl.nId} · ${strEventName}`,
    // 쿼리 리뷰만 쿼리 템플릿 (DBA 채널이어도 인스턴스 알림과 버튼을 섞지 않음)
    strButtonText: '쿼리 템플릿에서 보기',
    strButtonUrl: strBase ? `${strBase}/events?nTemplateId=${objTpl.nId}` : null,
  });
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
  objInstance: TSlackInstanceFields,
): void => {
  fnPostSlackPayloadToChannel(strChannel, fnBuildSlackInstancePayload(strTitle, objInstance));
};

const fnSendSlackForInstance = (objInstance: IEventInstance): void => {
  if (fnShouldNotifySlackDbaChannel(objInstance.strStatus)) {
    fnSendSlackToChannel(
      'dba',
      fnGetInstanceSlackTitle('dba', objInstance.strStatus),
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
      fnGetInstanceSlackTitle(strProductChannel, objInstance.strStatus),
      objInstance,
    );
  }
};

export const fnNotifySlackInstanceCreated = (objInstance: IEventInstance): void => {
  if (!fnIsSlackNotificationsEnabled()) return;
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
  fnPostSlackPayloadToChannel('dba', fnBuildSlackTemplatePayload(strTitle, objTpl));
};
