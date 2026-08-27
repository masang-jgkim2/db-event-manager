/**
 * 인스턴스 strInputValues — 신규 JSON / 구 \u0001 dual-read
 * (backend/src/utils/instanceInputValues.ts 와 동일 규칙)
 */

export const MULTI_SET_INPUT_DELIMITER = '\u0001';

export type TInstanceInputValuesV1 = {
  v: 1;
  sets: Array<Record<string, string>>;
};

export const fnIsInstanceInputValuesJson = (strRaw: string): boolean => {
  const str = strRaw.trim();
  return str.startsWith('{') && str.includes('"sets"');
};

export const fnEncodeInstanceInputValues = (
  arrSetMaps: Array<Record<string, string>>,
): string => JSON.stringify({ v: 1, sets: arrSetMaps } satisfies TInstanceInputValuesV1);

export const fnDecodeInstanceInputValues = (
  strRaw: string,
  arrSlotsPerSet: Array<Array<{ strInputId: string }>>,
): Array<Record<string, string>> => {
  const nSetCount = Math.max(arrSlotsPerSet.length, 1);
  const arrEmpty = (): Array<Record<string, string>> =>
    Array.from({ length: nSetCount }, () => ({}));

  const strTrim = (strRaw ?? '').trim();
  if (!strTrim) return arrEmpty();

  if (fnIsInstanceInputValuesJson(strTrim)) {
    try {
      const obj = JSON.parse(strTrim) as TInstanceInputValuesV1;
      if (obj?.v === 1 && Array.isArray(obj.sets)) {
        return Array.from({ length: nSetCount }, (_, i) => {
          const objSet = obj.sets[i] ?? {};
          const objOut: Record<string, string> = {};
          for (const objSlot of arrSlotsPerSet[i] ?? []) {
            const strId = objSlot.strInputId;
            objOut[strId] = String(objSet[strId] ?? '');
          }
          for (const [strKey, strVal] of Object.entries(objSet)) {
            if (objOut[strKey] === undefined) objOut[strKey] = String(strVal ?? '');
          }
          return objOut;
        });
      }
    } catch {
      // legacy
    }
  }

  const arrParts = strTrim.split(MULTI_SET_INPUT_DELIMITER);
  return Array.from({ length: nSetCount }, (_, i) => {
    const strPart = (arrParts[i] ?? (i === 0 ? strTrim : '')).trim();
    const arrSlots = arrSlotsPerSet[i] ?? [];
    const objOut: Record<string, string> = {};
    if (arrSlots.length === 0) {
      objOut.items = strPart;
      return objOut;
    }
    const objTarget = arrSlots.find((s) => s.strInputId) ?? arrSlots[0];
    for (const objSlot of arrSlots) {
      objOut[objSlot.strInputId] = objSlot.strInputId === objTarget.strInputId ? strPart : '';
    }
    return objOut;
  });
};
