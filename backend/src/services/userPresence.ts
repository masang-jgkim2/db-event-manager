/**
 * 인메모리 사용자 최근 활동(온라인 근사치).
 * 서버 재시작 시 초기화 · 다중 인스턴스 간 공유 없음.
 */
import { arrUsers } from '../data/users';
import { fnBroadcastUserPresence } from './sseBroadcaster';

const mapLastSeenMs = new Map<number, number>();
const mapLastSseEmitMs = new Map<number, number>();
/** 스윕용 직전 온라인 여부 — 오프라인 전환 시에만 SSE 송신 */
const mapSweepPrevOnline = new Map<number, boolean>();

let nSweepTimer: ReturnType<typeof setInterval> | null = null;

const N_ONLINE_WINDOW_MS = Math.max(
  60_000,
  Math.min(60 * 60_000, Number(process.env.USER_ONLINE_WINDOW_MS) || 3 * 60_000),
);

const N_SSE_THROTTLE_MS = 1_200;

export const fnIsUserOnlineByPresence = (nUserId: number): boolean => {
  const nMs = mapLastSeenMs.get(nUserId);
  if (nMs == null) return false;
  return Date.now() - nMs < N_ONLINE_WINDOW_MS;
};

export const fnGetUserLastSeenIso = (nUserId: number): string | null => {
  const nMs = mapLastSeenMs.get(nUserId);
  return nMs != null ? new Date(nMs).toISOString() : null;
};

const fnEmitPresenceSseThrottled = (nUserId: number): void => {
  if (nUserId <= 0) return;
  const nNow = Date.now();
  const nPrev = mapLastSseEmitMs.get(nUserId) ?? 0;
  if (nNow - nPrev < N_SSE_THROTTLE_MS) return;
  mapLastSseEmitMs.set(nUserId, nNow);
  fnBroadcastUserPresence({
    nUserId,
    bOnline: fnIsUserOnlineByPresence(nUserId),
    strLastSeenAt: fnGetUserLastSeenIso(nUserId),
  });
};

const fnSweepPresenceTransitions = (): void => {
  for (const u of arrUsers) {
    const bNow = fnIsUserOnlineByPresence(u.nId);
    const bPrev = mapSweepPrevOnline.get(u.nId);
    if (bPrev === undefined) {
      mapSweepPrevOnline.set(u.nId, bNow);
      continue;
    }
    if (bPrev !== bNow) {
      mapSweepPrevOnline.set(u.nId, bNow);
      fnBroadcastUserPresence({
        nUserId: u.nId,
        bOnline: bNow,
        strLastSeenAt: fnGetUserLastSeenIso(u.nId),
      });
    }
  }
};

/** 서버 기동 후 1회 — 온라인→오프라인 경계를 주기적으로 브로드캐스트 */
export const fnStartUserPresenceSweep = (): void => {
  if (nSweepTimer != null) return;
  const nIntervalMs = Math.min(30_000, Math.max(8_000, Math.floor(N_ONLINE_WINDOW_MS / 12)));
  nSweepTimer = setInterval(fnSweepPresenceTransitions, nIntervalMs);
};

export const fnTouchUserPresence = (nUserId: number): void => {
  if (nUserId > 0) {
    mapLastSeenMs.set(nUserId, Date.now());
    mapSweepPrevOnline.set(nUserId, true);
    fnEmitPresenceSseThrottled(nUserId);
  }
};

/** SSE 연결 직후 스냅샷 — 등록된 사용자 nId 기준 */
export const fnBuildPresenceSnapshotRows = (): Array<{
  nUserId: number;
  bOnline: boolean;
  strLastSeenAt: string | null;
}> =>
  arrUsers.map((u) => ({
    nUserId: u.nId,
    bOnline: fnIsUserOnlineByPresence(u.nId),
    strLastSeenAt: fnGetUserLastSeenIso(u.nId),
  }));
