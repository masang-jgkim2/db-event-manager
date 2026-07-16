/** 쿼리 템플릿 {{inputId}} 치환용 입력 정규화 — item_number/item_string */
export type TInputFormatForItems = 'item_number' | 'item_string' | 'date' | 'none';

/** comma: 쉼표 목록 | comma_quoted_inner: '{{id}}' 안쪽 | values: VALUES 행 */
type TItemsJoinMode = 'comma' | 'comma_quoted_inner' | 'values';

const STR_DEFAULT_INPUT_ID = 'items';

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
  strInputFormat: TInputFormatForItems,
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

/** 템플릿 패턴별 {{strInputId}} 치환 (기본 items) */
export const fnReplaceItemsInTemplate = (
  strTemplate: string,
  strRaw: string,
  strInputFormat: TInputFormatForItems = 'item_number',
  strInputId: string = STR_DEFAULT_INPUT_ID,
): string => {
  const strId = (strInputId || STR_DEFAULT_INPUT_ID).trim() || STR_DEFAULT_INPUT_ID;
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
  strInputFormat: TInputFormatForItems = 'item_number',
): string => {
  const strTrimmed = strRaw.trim();
  if (!strTrimmed || strInputFormat === 'none' || strInputFormat === 'date') {
    return strTrimmed;
  }
  const arrParts = fnParseItemParts(strRaw);
  if (arrParts.length === 0) return '';
  return fnFormatItemsChunk(arrParts, strInputFormat, 'comma');
};
