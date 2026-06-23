import type { IService } from '../types';

/** UI 공통 라벨 — `products.arrServices`, `db_connection.strServiceAbbr`, 인스턴스 `strServiceAbbr` */
export const STR_SERVICE_SCOPE_LABEL = '서비스 구분';

/** @deprecated STR_SERVICE_SCOPE_LABEL 사용 — 메시지·구형 import 호환 */
export const STR_COUNTRY_PLATFORM_LABEL = STR_SERVICE_SCOPE_LABEL;

/** 서비스 약자 — FH/KR, LH/KR, DK/KR, DK/G 등 (UI 주 표기) */
export const fnFormatCountryPlatformAbbr = (strAbbr: string): string => strAbbr.trim();

/** 리전 보조 라벨 (국내·스팀 등) */
export const fnFormatCountryPlatformRegion = (strRegion: string): string => {
  switch (strRegion) {
    case '국내':
      return '국내(한국)';
    case '글로벌':
      return '해외(글로벌)';
    case '스팀':
      return '해외(스팀)';
    case '유럽':
      return '해외(유럽)';
    case '일본':
      return '해외(일본)';
    default:
      return strRegion;
  }
};

/** Select·태그용 — `#391474 AD/G · 해외(글로벌)` (nServiceId 있으면 접두) */
export const fnFormatCountryPlatformOption = (
  objSvc: Pick<IService, 'strAbbr' | 'strRegion' | 'nServiceId'>,
): string => {
  const strBase = `${fnFormatCountryPlatformAbbr(objSvc.strAbbr)} · ${fnFormatCountryPlatformRegion(objSvc.strRegion)}`;
  return objSvc.nServiceId ? `#${objSvc.nServiceId} ${strBase}` : strBase;
};

/** DB 접속 행 — 약자 없으면 fallback 안내 */
export const fnFormatDbConnectionCountryPlatform = (strServiceAbbr?: string | null): string => {
  const strAbbr = (strServiceAbbr ?? '').trim();
  return strAbbr || '전체(미지정)';
};

/** 사용자 메시지용 — `서비스 구분「DK/KR」` */
export const fnFormatCountryPlatformMessage = (strAbbr: string): string =>
  `${STR_SERVICE_SCOPE_LABEL}「${fnFormatCountryPlatformAbbr(strAbbr)}」`;

export const fnFormatServiceScopeMessage = fnFormatCountryPlatformMessage;
