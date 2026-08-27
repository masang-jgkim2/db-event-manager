import type { TInputFormatForItems } from './queryTemplateItems';

/** 세트 입력 ID 기본값 — SQL 플레이스홀더 {{items}} */
export const STR_DEFAULT_QUERY_SET_INPUT_ID = 'items';

export type TQuerySetInputSlot = {
  strInputId: string;
  strInputFormat: TInputFormatForItems;
  strDefaultItems?: string;
};

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

const fnNormalizeOneSlot = (
  objRaw: { strInputId?: string; strInputFormat?: string; strDefaultItems?: string },
  strTemplateFormatFallback: string,
): TQuerySetInputSlot => {
  const strInputId = fnNormalizeQuerySetInputId(objRaw.strInputId);
  const strInputFormat = fnNormalizeQuerySetInputFormat(objRaw.strInputFormat, strTemplateFormatFallback);
  const strDefault = (objRaw.strDefaultItems ?? '').trim();
  return {
    strInputId,
    strInputFormat,
    ...(strDefault ? { strDefaultItems: strDefault } : {}),
  };
};

/**
 * 세트 입력 슬롯 정규화 — arrInputs 우선, 없으면 레거시 1슬롯 dual-read.
 * 세트 안 strInputId 중복 시 뒤 슬롯은 건너뜀.
 */
export const fnNormalizeQuerySetInputs = (
  objSet: {
    arrInputs?: Array<{ strInputId?: string; strInputFormat?: string; strDefaultItems?: string }>;
    strInputId?: string;
    strInputFormat?: string;
    strDefaultItems?: string;
  },
  strTemplateFormatFallback: string = 'item_number',
): TQuerySetInputSlot[] => {
  const arrRaw = Array.isArray(objSet.arrInputs) ? objSet.arrInputs : [];
  const arrFromArr: TQuerySetInputSlot[] = [];
  const setSeen = new Set<string>();
  for (const obj of arrRaw) {
    const objSlot = fnNormalizeOneSlot(obj ?? {}, strTemplateFormatFallback);
    if (setSeen.has(objSlot.strInputId)) continue;
    setSeen.add(objSlot.strInputId);
    arrFromArr.push(objSlot);
  }
  if (arrFromArr.length > 0) return arrFromArr;

  return [
    fnNormalizeOneSlot(
      {
        strInputId: objSet.strInputId,
        strInputFormat: objSet.strInputFormat,
        strDefaultItems: objSet.strDefaultItems,
      },
      strTemplateFormatFallback,
    ),
  ];
};

/** 첫 슬롯 → 레거시 필드 미러 (목록·구 코드 호환) */
export const fnMirrorLegacyInputFieldsFromSlots = (
  arrInputs: TQuerySetInputSlot[],
): { strInputId: string; strInputFormat: TInputFormatForItems; strDefaultItems?: string } => {
  const objFirst = arrInputs[0] ?? fnNormalizeOneSlot({}, 'item_number');
  return {
    strInputId: objFirst.strInputId,
    strInputFormat: objFirst.strInputFormat,
    ...(objFirst.strDefaultItems ? { strDefaultItems: objFirst.strDefaultItems } : {}),
  };
};

/** 세트 정규화 — 입력 ID·형식 dual-read (템플릿 format fallback) — 레거시 API */
export const fnNormalizeQuerySetInputFields = (
  objSet: {
    arrInputs?: Array<{ strInputId?: string; strInputFormat?: string; strDefaultItems?: string }>;
    strInputId?: string;
    strInputFormat?: string;
    strDefaultItems?: string;
  },
  strTemplateFormatFallback: string = 'item_number',
): { strInputId: string; strInputFormat: TInputFormatForItems } => {
  const objMirror = fnMirrorLegacyInputFieldsFromSlots(
    fnNormalizeQuerySetInputs(objSet, strTemplateFormatFallback),
  );
  return { strInputId: objMirror.strInputId, strInputFormat: objMirror.strInputFormat };
};

/** 세트 안 ID 중복 여부 — 저장 검증용 (정규화 전 raw) */
export const fnFindDuplicateInputIdsInSet = (
  arrInputs: Array<{ strInputId?: string }>,
): string | null => {
  const setSeen = new Set<string>();
  for (const obj of arrInputs) {
    const strId = (obj.strInputId ?? '').trim();
    if (!strId) continue;
    if (setSeen.has(strId)) return strId;
    setSeen.add(strId);
  }
  return null;
};

/** 세트 배열 — 중복 ID 메시지 (저장 전 검증) */
export const fnFindDuplicateInputIdMessageInSets = (
  arrSets: Array<{ arrInputs?: Array<{ strInputId?: string }> }>,
): { nSetIdx: number; strMessage: string } | null => {
  for (let nIdx = 0; nIdx < arrSets.length; nIdx++) {
    const arrSlots = arrSets[nIdx].arrInputs ?? [];
    if (arrSlots.length === 0) continue;
    const strDup = fnFindDuplicateInputIdsInSet(arrSlots);
    if (strDup) {
      return {
        nSetIdx: nIdx,
        strMessage: `세트 ${nIdx + 1}: 입력 ID "${strDup}"가 중복됩니다.`,
      };
    }
  }
  return null;
};
