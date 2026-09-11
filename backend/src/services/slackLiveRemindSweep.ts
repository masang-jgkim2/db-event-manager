/**
 * LIVE 미리알림 — live_requested 이후, 반영 시각 N분 전(기본 10) DBA 채널 1회.
 * 기존 상태 변경 Slack(요청/완료)과 독립.
 */
import { arrEventInstances, fnCommitEventInstancesToStore, type IEventInstance } from '../data/eventInstances';
import { fnIsSlackNotificationsEnabled } from './slackIncomingWebhook';
import { fnNotifySlackLiveRemind, fnResolveSlackDeployAtIso } from './slackNotifier';

let nSweepTimer: ReturnType<typeof setInterval> | null = null;
let bSweepRunning = false;

const fnParseTruthyEnv = (strRaw?: string): boolean => {
  const s = (strRaw ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
};

/** SLACK_NOTIFICATIONS_ENABLED 켜진 뒤, SLACK_REMINDERS_ENABLED 가 꺼지지 않으면 동작 */
export const fnIsSlackLiveRemindEnabled = (): boolean => {
  if (!fnIsSlackNotificationsEnabled()) return false;
  const strRaw = process.env.SLACK_REMINDERS_ENABLED?.trim();
  if (!strRaw) return true;
  return fnParseTruthyEnv(strRaw);
};

export const fnGetLiveRemindLeadMs = (): number => {
  const nMin = Number(process.env.SLACK_LIVE_REMIND_MINUTES);
  const nSafe = Number.isFinite(nMin) && nMin > 0 ? nMin : 10;
  return Math.floor(nSafe * 60_000);
};

/** 테스트·스윕 공용 — 발송 대상 여부 (플래그 기록 전) */
export const fnShouldSendLiveSlackRemind = (
  objInstance: Pick<
    IEventInstance,
    | 'bLiveSlackRemind'
    | 'dtSlackLiveRemindedAt'
    | 'strStatus'
    | 'bPermanentlyRemoved'
    | 'dtQaDeployDate'
    | 'dtLiveDeployDate'
    | 'dtDeployDate'
  >,
  dtNow: Date = new Date(),
): boolean => {
  if (!objInstance.bLiveSlackRemind) return false;
  if (objInstance.bPermanentlyRemoved) return false;
  if (objInstance.strStatus !== 'live_requested') return false;
  if (objInstance.dtSlackLiveRemindedAt) return false;
  const strDeployIso = fnResolveSlackDeployAtIso({
    strStatus: 'live_requested',
    dtQaDeployDate: objInstance.dtQaDeployDate,
    dtLiveDeployDate: objInstance.dtLiveDeployDate,
    dtDeployDate: objInstance.dtDeployDate,
  });
  if (!strDeployIso) return false;
  const nDeployMs = new Date(strDeployIso).getTime();
  if (Number.isNaN(nDeployMs)) return false;
  // T−lead 이후(이미 지났어도) 미발송이면 1회 — late live_requested 보정
  return dtNow.getTime() >= nDeployMs - fnGetLiveRemindLeadMs();
};

export const fnSweepLiveSlackReminds = async (dtNow: Date = new Date()): Promise<number> => {
  if (!fnIsSlackLiveRemindEnabled()) return 0;
  let nSent = 0;
  const arrDue = arrEventInstances.filter((obj) => fnShouldSendLiveSlackRemind(obj, dtNow));
  if (arrDue.length === 0) return 0;
  const strNow = dtNow.toISOString();
  for (const obj of arrDue) {
    obj.dtSlackLiveRemindedAt = strNow;
    fnNotifySlackLiveRemind(obj);
    nSent += 1;
    console.log(`[Slack 미리알림] LIVE | #${obj.nId} | ${obj.strEventName}`);
  }
  await fnCommitEventInstancesToStore();
  return nSent;
};

const fnOnSweepTick = (): void => {
  if (bSweepRunning) return;
  bSweepRunning = true;
  void fnSweepLiveSlackReminds()
    .catch((err: unknown) => {
      console.error('[Slack 미리알림] sweep 실패 |', err);
    })
    .finally(() => {
      bSweepRunning = false;
    });
};

/** 서버 기동 후 주기 스캔 (기본 60초) */
export const fnStartSlackLiveRemindSweep = (): void => {
  if (nSweepTimer != null) return;
  const nEnv = Number(process.env.SLACK_LIVE_REMIND_SWEEP_MS);
  const nIntervalMs = Number.isFinite(nEnv) && nEnv >= 10_000
    ? Math.floor(nEnv)
    : 60_000;
  nSweepTimer = setInterval(fnOnSweepTick, nIntervalMs);
  console.log(`[Slack 미리알림] sweep 시작 | ${nIntervalMs}ms`);
};
