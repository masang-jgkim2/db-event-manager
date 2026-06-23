/** Slack Incoming Webhook POST — 채널별 URL은 환경 변수로 분리 */

/** DBA·live + 프로덕트 서비스 약어 접두사(GZ, DK, …)별 GM 채널 */
export type TSlackWebhookChannel =
  | 'dba'
  | 'live'
  | 'gz'
  | 'nd'
  | 'nx'
  | 'lh'
  | 'mv'
  | 'sr'
  | 'ad'
  | 'ao'
  | 'fh'
  | 'cc'
  | 'kr'
  | 'pt'
  | 'dk';

const ENV_CHANNEL_URL: Record<TSlackWebhookChannel, string> = {
  dba: 'SLACK_WEBHOOK_URL_DBA',
  live: 'SLACK_WEBHOOK_URL_LIVE',
  gz: 'SLACK_WEBHOOK_URL_GZ',
  nd: 'SLACK_WEBHOOK_URL_ND',
  nx: 'SLACK_WEBHOOK_URL_NX',
  lh: 'SLACK_WEBHOOK_URL_LH',
  mv: 'SLACK_WEBHOOK_URL_MV',
  sr: 'SLACK_WEBHOOK_URL_SR',
  ad: 'SLACK_WEBHOOK_URL_AD',
  ao: 'SLACK_WEBHOOK_URL_AO',
  fh: 'SLACK_WEBHOOK_URL_FH',
  cc: 'SLACK_WEBHOOK_URL_CC',
  kr: 'SLACK_WEBHOOK_URL_KR',
  pt: 'SLACK_WEBHOOK_URL_PT',
  dk: 'SLACK_WEBHOOK_URL_DK',
};

export const fnIsSlackNotificationsEnabled = (): boolean => {
  const strFlag = process.env.SLACK_NOTIFICATIONS_ENABLED?.trim().toLowerCase();
  return strFlag === '1' || strFlag === 'true' || strFlag === 'on' || strFlag === 'yes';
};

export const fnGetSlackWebhookUrl = (strChannel: TSlackWebhookChannel): string | null => {
  const strEnvKey = ENV_CHANNEL_URL[strChannel];
  const strUrl = process.env[strEnvKey]?.trim();
  return strUrl || null;
};

export const fnPostSlackIncomingWebhook = async (
  strWebhookUrl: string,
  objPayload: Record<string, unknown>,
): Promise<boolean> => {
  try {
    const res = await fetch(strWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(objPayload),
    });
    if (!res.ok) {
      const strBody = await res.text().catch(() => '');
      console.error(`[Slack] 웹훅 실패 | HTTP ${res.status} | ${strBody.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Slack] 웹훅 전송 오류', err);
    return false;
  }
};
