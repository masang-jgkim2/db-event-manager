import type { IEventInstance } from '../types';

type TDeployEnv = 'qa' | 'live';

/**
 * 스코프·레거시 dtDeployDate를 반영한 표시용 반영일시.
 * env 전용 필드가 있으면 그것만 사용하고, 반대 env 날짜를 dtDeployDate로 채우지 않음.
 * dtDeployDate fallback은 QA/LIVE 전용 필드가 둘 다 없을 때만 (순수 레거시).
 */
export const fnResolveDeployDateIso = (
  obj: Pick<IEventInstance, 'dtQaDeployDate' | 'dtLiveDeployDate' | 'dtDeployDate' | 'arrDeployScope'>,
  strEnv: TDeployEnv,
): { strIso: string | null; bInScope: boolean } => {
  const arrScope = obj.arrDeployScope ?? ['qa', 'live'];
  const bInScope = arrScope.includes(strEnv);
  if (!bInScope) return { strIso: null, bInScope: false };

  const strQa = (obj.dtQaDeployDate ?? '').trim();
  const strLive = (obj.dtLiveDeployDate ?? '').trim();
  const strLegacy = (obj.dtDeployDate ?? '').trim();

  if (strEnv === 'qa') {
    if (strQa) return { strIso: strQa, bInScope: true };
    // 전용 필드가 전혀 없을 때만 레거시 단일 값을 QA로 표시
    if (!strLive && strLegacy) return { strIso: strLegacy, bInScope: true };
    return { strIso: null, bInScope: true };
  }

  if (strLive) return { strIso: strLive, bInScope: true };
  if (!strQa && strLegacy) return { strIso: strLegacy, bInScope: true };
  return { strIso: null, bInScope: true };
};

export const fnFormatDeployDateDisplay = (
  obj: Pick<IEventInstance, 'dtQaDeployDate' | 'dtLiveDeployDate' | 'dtDeployDate' | 'arrDeployScope'>,
  strEnv: TDeployEnv,
  strStyle: 'short' | 'full' = 'short',
): string => {
  const { strIso, bInScope } = fnResolveDeployDateIso(obj, strEnv);
  if (!bInScope) return '해당없음';
  if (!strIso) return '-';
  const dt = new Date(strIso);
  if (Number.isNaN(dt.getTime())) return strIso;
  return strStyle === 'full'
    ? dt.toLocaleString('ko-KR')
    : dt.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
};
