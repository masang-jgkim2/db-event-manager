import type { TInputFormat } from '../types';
import { STR_DEFAULT_QUERY_SET_INPUT_ID } from '../types';

type TItemsJoinMode = 'comma' | 'comma_quoted_inner' | 'values';

const fnBuildPlaceholder = (strInputId: string): string => `{{${strInputId}}}`;

const fnEscapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fnParseItemParts = (strRaw: string): string[] =>
  strRaw
    .trim()
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const fnIsQuotedItemsPlaceholder = (strTemplate: string, nIndex: number, nPhLen: number): boolean => {
  let i = nIndex - 1;
  while (i >= 0 && /\s/.test(strTemplate[i])) i--;
  if (i < 0 || strTemplate[i] !== "'") return false;

  let j = nIndex + nPhLen;
  while (j < strTemplate.length && /\s/.test(strTemplate[j])) j++;
  return j < strTemplate.length && strTemplate[j] === "'";
};

const fnIsParenWrappedItemsPlaceholder = (strTemplate: string, nIndex: number, nPhLen: number): boolean => {
  let i = nIndex - 1;
  while (i >= 0 && /\s/.test(strTemplate[i])) i--;
  if (i < 0 || strTemplate[i] !== '(') return false;

  let j = nIndex + nPhLen;
  while (j < strTemplate.length && /\s/.test(strTemplate[j])) j++;
  return j < strTemplate.length && strTemplate[j] === ')';
};

const fnIsValuesItemsPlaceholder = (strTemplate: string, nIndex: number): boolean => {
  const strBefore = strTemplate.slice(0, nIndex).replace(/\s+$/, '');
  return /\bVALUES(?:\s--[^\r\n]*)?$/i.test(strBefore);
};

const fnDetectItemsJoinMode = (strTemplate: string, nIndex: number, nPhLen: number): TItemsJoinMode => {
  if (fnIsValuesItemsPlaceholder(strTemplate, nIndex)) return 'values';
  if (fnIsQuotedItemsPlaceholder(strTemplate, nIndex, nPhLen)) return 'comma_quoted_inner';
  if (fnIsParenWrappedItemsPlaceholder(strTemplate, nIndex, nPhLen)) return 'comma';
  return 'comma';
};

const fnEscapeSqlString = (strPart: string): string => strPart.replace(/'/g, "''");

const fnFormatItemsChunk = (
  arrParts: string[],
  strInputFormat: TInputFormat,
  strJoinMode: TItemsJoinMode,
): string => {
  if (arrParts.length === 0) return '';

  if (strJoinMode === 'values') {
    if (strInputFormat === 'item_string') {
      return arrParts.map((s) => `('${fnEscapeSqlString(s)}')`).join(', ');
    }
    return arrParts.map((s) => `(${s})`).join(', ');
  }

  if (strJoinMode === 'comma_quoted_inner') {
    return arrParts.map((s) => fnEscapeSqlString(s)).join(', ');
  }

  if (strInputFormat === 'item_string') {
    return arrParts.map((s) => `'${fnEscapeSqlString(s)}'`).join(', ');
  }
  return arrParts.join(', ');
};

export const fnReplaceItemsInTemplate = (
  strTemplate: string,
  strRaw: string,
  strInputFormat: TInputFormat = 'item_number',
  strInputId: string = STR_DEFAULT_QUERY_SET_INPUT_ID,
): string => {
  const strId = (strInputId || STR_DEFAULT_QUERY_SET_INPUT_ID).trim() || STR_DEFAULT_QUERY_SET_INPUT_ID;
  const strPh = fnBuildPlaceholder(strId);
  const nPhLen = strPh.length;
  const rePh = new RegExp(fnEscapeRegExp(strPh), 'g');

  const strTrimmed = strRaw.trim();
  if (!strTrimmed || strInputFormat === 'none' || strInputFormat === 'date') {
    return strTemplate.replace(rePh, strTrimmed);
  }

  const arrParts = fnParseItemParts(strRaw);
  if (arrParts.length === 0) {
    return strTemplate.replace(rePh, '');
  }

  return strTemplate.replace(rePh, (_match, nOffset: number) =>
    fnFormatItemsChunk(arrParts, strInputFormat, fnDetectItemsJoinMode(strTemplate, nOffset, nPhLen)),
  );
};

export const fnNormalizeItemsForTemplate = (
  strRaw: string,
  strInputFormat: TInputFormat = 'item_number',
): string => {
  const strTrimmed = strRaw.trim();
  if (!strTrimmed || strInputFormat === 'none' || strInputFormat === 'date') {
    return strTrimmed;
  }
  const arrParts = fnParseItemParts(strRaw);
  if (arrParts.length === 0) return '';
  return fnFormatItemsChunk(arrParts, strInputFormat, 'comma');
};
