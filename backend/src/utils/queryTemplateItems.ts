/** 쿼리 템플릿 {{items}} 치환용 입력 정규화 — item_number/item_string */
export type TInputFormatForItems = 'item_number' | 'item_string' | 'date' | 'none';

/** comma: 쉼표 목록 | comma_quoted_inner: '{{items}}' 안쪽 | values: VALUES 행 */
type TItemsJoinMode = 'comma' | 'comma_quoted_inner' | 'values';

const PLACEHOLDER_ITEMS = '{{items}}';

const fnParseItemParts = (strRaw: string): string[] =>
  strRaw
    .trim()
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const fnIsQuotedItemsPlaceholder = (strTemplate: string, nIndex: number): boolean => {
  let i = nIndex - 1;
  while (i >= 0 && /\s/.test(strTemplate[i])) i--;
  if (i < 0 || strTemplate[i] !== "'") return false;

  let j = nIndex + PLACEHOLDER_ITEMS.length;
  while (j < strTemplate.length && /\s/.test(strTemplate[j])) j++;
  return j < strTemplate.length && strTemplate[j] === "'";
};

const fnIsParenWrappedItemsPlaceholder = (strTemplate: string, nIndex: number): boolean => {
  let i = nIndex - 1;
  while (i >= 0 && /\s/.test(strTemplate[i])) i--;
  if (i < 0 || strTemplate[i] !== '(') return false;

  let j = nIndex + PLACEHOLDER_ITEMS.length;
  while (j < strTemplate.length && /\s/.test(strTemplate[j])) j++;
  return j < strTemplate.length && strTemplate[j] === ')';
};

const fnIsValuesItemsPlaceholder = (strTemplate: string, nIndex: number): boolean => {
  const strBefore = strTemplate.slice(0, nIndex).replace(/\s+$/, '');
  // VALUES 바로 뒤 같은 줄 `-- 주석` 허용 (다음 줄 {{items}} 인 경우)
  return /\bVALUES(?:\s--[^\r\n]*)?$/i.test(strBefore);
};

const fnDetectItemsJoinMode = (strTemplate: string, nIndex: number): TItemsJoinMode => {
  if (fnIsValuesItemsPlaceholder(strTemplate, nIndex)) return 'values';
  if (fnIsQuotedItemsPlaceholder(strTemplate, nIndex)) return 'comma_quoted_inner';
  if (fnIsParenWrappedItemsPlaceholder(strTemplate, nIndex)) return 'comma';
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

  // comma — ({{items}}), IN ({{items}}) 등
  if (strInputFormat === 'item_string') {
    return arrParts.map((s) => `'${fnEscapeSqlString(s)}'`).join(', ');
  }
  return arrParts.join(', ');
};

/** 템플릿 패턴별 {{items}} 치환 */
export const fnReplaceItemsInTemplate = (
  strTemplate: string,
  strRaw: string,
  strInputFormat: TInputFormatForItems = 'item_number',
): string => {
  const strTrimmed = strRaw.trim();
  if (!strTrimmed || strInputFormat === 'none' || strInputFormat === 'date') {
    return strTemplate.replace(/\{\{items\}\}/g, strTrimmed);
  }

  const arrParts = fnParseItemParts(strRaw);
  if (arrParts.length === 0) {
    return strTemplate.replace(/\{\{items\}\}/g, '');
  }

  return strTemplate.replace(/\{\{items\}\}/g, (_match, nOffset: number) =>
    fnFormatItemsChunk(arrParts, strInputFormat, fnDetectItemsJoinMode(strTemplate, nOffset)),
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
