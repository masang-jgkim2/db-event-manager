import { STR_DBA_PASS, STR_DBA_USER, STR_GM2_PASS, STR_GM2_USER, STR_GM_PASS, STR_GM_USER } from './auth';

/** E2E 대상 이벤트 생성자 로그인 ID (gm01 · dba01 · gm02) */
export const ARR_E2E_CREATOR_LOGIN_IDS = [STR_GM_USER, STR_DBA_USER, STR_GM2_USER] as const;

export type TE2eInstanceRef = {
  nId: number;
  strStatus: string;
  nCreatedByUserId?: number;
  strCreatedBy?: string;
  bPermanentlyRemoved?: boolean;
};

const STR_API_DEFAULT = (process.env.E2E_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');

/** "152-162" 또는 "152,153,160" → 번호 배열 */
export const fnParseE2eInstancePool = (strRaw?: string): number[] => {
  const str = (strRaw || process.env.E2E_INSTANCE_POOL || '152-162').trim();
  if (!str) return [];
  const arr: number[] = [];
  for (const part of str.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    if (seg.includes('-')) {
      const [a, b] = seg.split('-').map((s) => Number(s.trim()));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        for (let n = Math.min(a, b); n <= Math.max(a, b); n++) arr.push(n);
      }
    } else {
      const n = Number(seg);
      if (Number.isFinite(n)) arr.push(n);
    }
  }
  return [...new Set(arr)];
};

export const fnFetchAllowedCreatorUserIds = async (
  strApiBase = STR_API_DEFAULT,
): Promise<Set<number>> => {
  const set = new Set<number>();
  const arrCreds: [string, string][] = [
    [STR_GM_USER, STR_GM_PASS],
    [STR_DBA_USER, STR_DBA_PASS],
    [STR_GM2_USER, STR_GM2_PASS],
  ];
  for (const [strUserId, strPassword] of arrCreds) {
    try {
      const res = await fetch(`${strApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strUserId, strPassword }),
      });
      const obj = await res.json();
      if (obj.user?.nId) set.add(Number(obj.user.nId));
    } catch {
      // gm02 미존재 시 무시
    }
  }
  return set;
};

export const fnApiGetInstance = async (
  strApiBase: string,
  strToken: string,
  nId: number,
): Promise<TE2eInstanceRef | null> => {
  const res = await fetch(`${strApiBase.replace(/\/$/, '')}/event-instances/${nId}`, {
    headers: { Authorization: `Bearer ${strToken}` },
  });
  const obj = await res.json();
  if (!res.ok || !obj.objInstance) return null;
  const inst = obj.objInstance;
  return {
    nId: inst.nId,
    strStatus: inst.strStatus,
    nCreatedByUserId: inst.nCreatedByUserId,
    strCreatedBy: inst.strCreatedBy,
    bPermanentlyRemoved: inst.bPermanentlyRemoved,
  };
};

/** QA DB 실행 성공 이후 단계 — 고정 ID 이어하기용 */
export const fnHasQaDeploySucceeded = (strStatus: string): boolean =>
  ['qa_deployed', 'qa_verified', 'live_requested', 'live_deployed', 'live_verified'].includes(
    strStatus,
  );

export const fnAssertE2eAllowedCreator = (
  objInst: TE2eInstanceRef,
  setAllowedUserIds: Set<number>,
): void => {
  if (objInst.bPermanentlyRemoved) {
    throw new Error(`#${objInst.nId} 영구 삭제됨 — E2E 대상 아님`);
  }
  const nUid = objInst.nCreatedByUserId;
  if (nUid == null || !setAllowedUserIds.has(nUid)) {
    throw new Error(
      `#${objInst.nId} 생성자 nUserId=${nUid} — E2E 허용 계정(${ARR_E2E_CREATOR_LOGIN_IDS.join(', ')})만 사용`,
    );
  }
};

/** 풀에서 상태·생성자 조건에 맞는 첫 인스턴스 */
export const fnPickPoolInstance = async (
  strApiBase: string,
  strToken: string,
  arrPoolIds: number[],
  setAllowedUserIds: Set<number>,
  strStatus: string,
  objOpts?: { nCreatorUserId?: number },
): Promise<number | null> => {
  for (const nId of arrPoolIds) {
    const obj = await fnApiGetInstance(strApiBase, strToken, nId);
    if (!obj || obj.strStatus !== strStatus) continue;
    try {
      fnAssertE2eAllowedCreator(obj, setAllowedUserIds);
      if (objOpts?.nCreatorUserId != null && obj.nCreatedByUserId !== objOpts.nCreatorUserId) continue;
      return nId;
    } catch {
      continue;
    }
  }
  return null;
};
