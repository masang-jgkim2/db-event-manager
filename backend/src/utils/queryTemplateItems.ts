/** 쿼리 템플릿 {{inputId}} 치환용 입력 정규화 — item_number/item_string */
export type TInputFormatForItems = 'item_number' | 'item_string' | 'date' | 'none';

/** comma: 쉼표 목록 | comma_quoted_inner: '{{id}}' 안쪽 | values: VALUES 행 */
type TItemsJoinMode = 'comma' | 'comma_quoted_inner' | 'values';

const STR_DEFAULT_INPUT_ID = 'items';

const fnBuildPlaceholder = (strInputId: string): string => `{{${strInputId}}}`;

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
  return fnReplaceAllInputsInTemplate(
    strTemplate,
    [{ strInputId: strId, strInputFormat }],
    { [strId]: strRaw },
  );
};

/**
 * 원본 템플릿 기준으로 슬롯별 치환 (순차 치환 시 VALUES/따옴표 문맥 깨짐 방지).
 * VALUES ({{a}},{{b}}) + 목록 zip 은 1차 비지원 — 슬롯별 독립 치환만.
 */
export const fnReplaceAllInputsInTemplate = (
  strTemplate: string,
  arrInputs: Array<{ strInputId: string; strInputFormat: TInputFormatForItems }>,
  mapValues: Record<string, string>,
): string => {
  type TMatch = { nStart: number; nEnd: number; strReplacement: string };
  const arrMatches: TMatch[] = [];

  for (const objSlot of arrInputs) {
    const strId = (objSlot.strInputId || STR_DEFAULT_INPUT_ID).trim() || STR_DEFAULT_INPUT_ID;
    const strPh = fnBuildPlaceholder(strId);
    const nPhLen = strPh.length;
    const strRaw = mapValues[strId] ?? '';
    const strFmt = objSlot.strInputFormat;
    let nFrom = 0;
    while (nFrom <= strTemplate.length) {
      const nIdx = strTemplate.indexOf(strPh, nFrom);
      if (nIdx < 0) break;
      const strTrimmed = strRaw.trim();
      let strReplacement = '';
      if (!strTrimmed || strFmt === 'none' || strFmt === 'date') {
        strReplacement = strTrimmed;
      } else {
        const arrParts = fnParseItemParts(strRaw);
        strReplacement = arrParts.length === 0
          ? ''
          : fnFormatItemsChunk(arrParts, strFmt, fnDetectItemsJoinMode(strTemplate, nIdx, nPhLen));
      }
      arrMatches.push({ nStart: nIdx, nEnd: nIdx + nPhLen, strReplacement });
      nFrom = nIdx + nPhLen;
    }
  }

  if (arrMatches.length === 0) return strTemplate;
  arrMatches.sort((a, b) => b.nStart - a.nStart);
  let strOut = strTemplate;
  for (const obj of arrMatches) {
    strOut = strOut.slice(0, obj.nStart) + obj.strReplacement + strOut.slice(obj.nEnd);
  }
  return strOut;
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
