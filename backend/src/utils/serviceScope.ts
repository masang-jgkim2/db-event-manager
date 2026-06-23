/** 서비스 약자 정규화 */
export const fnNormalizeServiceAbbr = (str?: string | null): string => (str ?? '').trim();

/**
 * 프로덕트·DB 접속 약자 호환 — CC↔CC/KR, FH↔FH/KR 등 마이그레이션 구간
 * (정확 일치 · 공통 fallback 은 fnConnectionMatchesServiceScope 에서 별도 처리)
 */
export const fnServiceAbbrsCompatible = (strConnAbbr: string, strInstAbbr: string): boolean => {
  const strA = fnNormalizeServiceAbbr(strConnAbbr);
  const strB = fnNormalizeServiceAbbr(strInstAbbr);
  if (!strA || !strB) return false;
  if (strA === strB) return true;
  return strB.startsWith(`${strA}/`) || strA.startsWith(`${strB}/`);
};
