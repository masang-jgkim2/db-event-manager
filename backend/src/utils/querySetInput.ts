import type { TInputFormatForItems } from './queryTemplateItems';

/** 세트 입력 ID 기본값 — SQL 플레이스홀더 {{items}} */
export const STR_DEFAULT_QUERY_SET_INPUT_ID = 'items';

const ARR_FORMATS: TInputFormatForItems[] = ['item_number', 'item_string', 'date', 'none'];
const REG_INPUT_ID = /^[a-z][a-z0-9_]{0,31}$/;

export const fnIsValidQuerySetInputId = (strRaw: string): boolean => REG_INPUT_ID.test(strRaw.trim());

export const fnNormalizeQuerySetInputId = (strRaw?: string): string => {
  const str = (strRaw ?? '').trim();
  return str && REG_INPUT_ID.test(str) ? str : STR_DEFAULT_QUERY_SET_INPUT_ID;
};

export const fnNormalizeQuerySetInputFormat = (
  strRaw?: string,
  strFallback: string = 'item_number',
): TInputFormatForItems => {
  const str = (strRaw ?? '').trim() as TInputFormatForItems;
  if (ARR_FORMATS.includes(str)) return str;
  const strFb = strFallback.trim() as TInputFormatForItems;
  return ARR_FORMATS.includes(strFb) ? strFb : 'item_number';
};

/** 세트 정규화 — 입력 ID·형식 dual-read (템플릿 format fallback) */
export const fnNormalizeQuerySetInputFields = (
  objSet: { strInputId?: string; strInputFormat?: string },
  strTemplateFormatFallback: string = 'item_number',
): { strInputId: string; strInputFormat: TInputFormatForItems } => ({
  strInputId: fnNormalizeQuerySetInputId(objSet.strInputId),
  strInputFormat: fnNormalizeQuerySetInputFormat(objSet.strInputFormat, strTemplateFormatFallback),
});
