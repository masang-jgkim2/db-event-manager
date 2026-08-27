/**
 * 인스턴스 strInputValues — 신규 JSON / 구 \u0001(세트당 1값) dual-read
 * JSON: { v: 1, sets: [ { item_id: "...", qty: "1" }, { items: "..." } ] }
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

/** 구 \u0001 또는 JSON → 세트별 슬롯 map 배열 (슬롯 정의로 키 맞춤) */
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
          // 슬롯 정의에 없는 키도 보존(템플릿 축소 전 수정 등)
          for (const [strKey, strVal] of Object.entries(objSet)) {
            if (objOut[strKey] === undefined) objOut[strKey] = String(strVal ?? '');
          }
          return objOut;
        });
      }
    } catch {
      // fall through to legacy
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
    // 레거시: 세트당 문자열 1개 → 첫 번째 none이 아닌 슬롯, 없으면 첫 슬롯
    const objTarget =
      arrSlots.find((s) => s.strInputId) ?? arrSlots[0];
    for (const objSlot of arrSlots) {
      objOut[objSlot.strInputId] = objSlot.strInputId === objTarget.strInputId ? strPart : '';
    }
    return objOut;
  });
};
