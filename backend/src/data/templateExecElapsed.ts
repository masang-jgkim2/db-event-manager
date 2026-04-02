// 쿼리 템플릿 + 환경별 마지막 성공 실행 소요(ms) — 인메모리 (DB화 시 테이블/캐시로 대체)

const mapElapsedMs = new Map<string, number>();

const fnKey = (nEventTemplateId: number, strEnv: 'qa' | 'live') => `${nEventTemplateId}_${strEnv}`;

export const fnGetTemplateExecElapsedMs = (nEventTemplateId: number, strEnv: 'qa' | 'live'): number => {
  const n = mapElapsedMs.get(fnKey(nEventTemplateId, strEnv));
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
};

export const fnSetTemplateExecElapsedMs = (
  nEventTemplateId: number,
  strEnv: 'qa' | 'live',
  nElapsedMs: number
): void => {
  if (!Number.isFinite(nElapsedMs) || nElapsedMs <= 0 || nEventTemplateId <= 0) return;
  mapElapsedMs.set(fnKey(nEventTemplateId, strEnv), Math.round(nElapsedMs));
  console.log(`[템플릿 실행 소요] 캐시 갱신 | templateId=${nEventTemplateId} | ${strEnv} | ${Math.round(nElapsedMs)}ms`);
};
