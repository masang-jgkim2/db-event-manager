import type { IQuerySetInputSlot, IQueryTemplateItem, TInputFormat } from '../types';
import { STR_DEFAULT_QUERY_SET_INPUT_ID } from '../types';

const ARR_FORMATS: TInputFormat[] = ['item_number', 'item_string', 'date', 'none'];
const REG_INPUT_ID = /^[a-z][a-z0-9_]{0,31}$/;

export const fnIsValidQuerySetInputId = (strRaw: string): boolean => REG_INPUT_ID.test(strRaw.trim());

export const fnNormalizeQuerySetInputId = (strRaw?: string): string => {
  const str = (strRaw ?? '').trim();
  return str && REG_INPUT_ID.test(str) ? str : STR_DEFAULT_QUERY_SET_INPUT_ID;
};

export const fnNormalizeQuerySetInputFormat = (
  strRaw?: string,
  strFallback: TInputFormat | string = 'item_number',
): TInputFormat => {
  const str = (strRaw ?? '').trim() as TInputFormat;
  if (ARR_FORMATS.includes(str)) return str;
  const strFb = String(strFallback).trim() as TInputFormat;
  return ARR_FORMATS.includes(strFb) ? strFb : 'item_number';
};

const fnNormalizeOneSlot = (
  objRaw: { strInputId?: string; strInputFormat?: string; strDefaultItems?: string },
  strTemplateFormatFallback: TInputFormat | string,
): IQuerySetInputSlot => {
  const strInputId = fnNormalizeQuerySetInputId(objRaw.strInputId);
  const strInputFormat = fnNormalizeQuerySetInputFormat(objRaw.strInputFormat, strTemplateFormatFallback);
  const strDefault = (objRaw.strDefaultItems ?? '').trim();
  return {
    strInputId,
    strInputFormat,
    ...(strDefault ? { strDefaultItems: strDefault } : {}),
  };
};

/** 세트 입력 슬롯 — arrInputs 우선, 없으면 레거시 1슬롯. 세트 안 ID 중복은 스킵 */
export const fnNormalizeQuerySetInputs = (
  objSet: Partial<IQueryTemplateItem>,
  strTemplateFormatFallback: TInputFormat | string = 'item_number',
): IQuerySetInputSlot[] => {
  const arrRaw = Array.isArray(objSet.arrInputs) ? objSet.arrInputs : [];
  const arrFromArr: IQuerySetInputSlot[] = [];
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

export const fnMirrorLegacyInputFieldsFromSlots = (
  arrInputs: IQuerySetInputSlot[],
): Pick<IQueryTemplateItem, 'strInputId' | 'strInputFormat' | 'strDefaultItems'> => {
  const objFirst = arrInputs[0] ?? fnNormalizeOneSlot({}, 'item_number');
  return {
    strInputId: objFirst.strInputId,
    strInputFormat: objFirst.strInputFormat,
    ...(objFirst.strDefaultItems ? { strDefaultItems: objFirst.strDefaultItems } : {}),
  };
};

/** arrInputs가 명시된 세트는 첫 슬롯 미러만 — stale 레거시 strDefaultItems 폴백 금지 */
export const fnResolveMirroredDefaultItems = (
  raw: Partial<IQueryTemplateItem>,
  objLegacy: Pick<IQueryTemplateItem, 'strDefaultItems'>,
): string | undefined => {
  if (objLegacy.strDefaultItems) return objLegacy.strDefaultItems;
  if (Array.isArray(raw.arrInputs) && raw.arrInputs.length > 0) return undefined;
  const strRaw = (raw.strDefaultItems ?? '').trim();
  return strRaw || undefined;
};

export const fnNormalizeQuerySetInputFields = (
  objSet: Partial<IQueryTemplateItem>,
  strTemplateFormatFallback: TInputFormat | string = 'item_number',
): Pick<IQueryTemplateItem, 'strInputId' | 'strInputFormat'> => {
  const objMirror = fnMirrorLegacyInputFieldsFromSlots(
    fnNormalizeQuerySetInputs(objSet, strTemplateFormatFallback),
  );
  return { strInputId: objMirror.strInputId, strInputFormat: objMirror.strInputFormat };
};

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

/** 세트 배열 — 중복 ID 메시지 (저장 전 UI·API 공통) */
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
