/** Slack Incoming Webhook POST — 채널별 URL은 환경 변수로 분리 */

export type TSlackWebhookChannel = 'dba' | 'live' | 'mv' | 'gz' | 'ad' | 'sr';

const ENV_CHANNEL_URL: Record<TSlackWebhookChannel, string> = {
  dba: 'SLACK_WEBHOOK_URL_DBA',
  live: 'SLACK_WEBHOOK_URL_LIVE',
  mv: 'SLACK_WEBHOOK_URL_MV',
  gz: 'SLACK_WEBHOOK_URL_GZ',
  ad: 'SLACK_WEBHOOK_URL_AD',
  sr: 'SLACK_WEBHOOK_URL_SR',
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
