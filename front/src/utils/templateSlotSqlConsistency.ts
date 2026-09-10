/** 메타 치환 변수 — 슬롯 ID 없이도 SQL에 둘 수 있음 */
export const SET_META_PLACEHOLDERS = new Set([
  'date',
  'event_name',
  'abbr',
  'product',
  'region',
]);

export type TSlotSqlIssue = {
  /** 0-based 세트 인덱스 */
  nSetIdx: number;
  strKind: 'orphan' | 'unused';
  arrIds: string[];
  strMessage: string;
};

type TSlotLike = { strInputId?: string; strInputFormat?: string };
type TSetLike = {
  strQueryTemplate?: string;
  arrInputs?: TSlotLike[];
  strInputId?: string;
  strInputFormat?: string;
};

/** SQL {{id}} 중 현재 슬롯에 없는 것 (메타 제외) */
export const fnFindOrphanInputPlaceholdersInSql = (
  strSql: string,
  arrInputs: TSlotLike[],
): string[] => {
  const setSlotIds = new Set(
    arrInputs
      .map((obj) => (obj.strInputId ?? '').trim())
      .filter((strId) => strId.length > 0),
  );
  const setFound = new Set<string>();
  const rePh = /\{\{([a-z][a-z0-9_]{0,31})\}\}/g;
  let objMatch: RegExpExecArray | null;
  while ((objMatch = rePh.exec(strSql)) !== null) {
    const strId = objMatch[1];
    if (SET_META_PLACEHOLDERS.has(strId) || setSlotIds.has(strId)) continue;
    setFound.add(strId);
  }
  return [...setFound];
};

/** 활성 슬롯 ID가 SQL에 {{id}}로 없는 경우 (prefix 오판 방지 — includes 금지) */
export const fnFindUnusedSlotIdsInSql = (
  strSql: string,
  arrInputs: TSlotLike[],
): string[] => {
  const setPh = new Set<string>();
  const rePh = /\{\{([a-z][a-z0-9_]{0,31})\}\}/g;
  let objMatch: RegExpExecArray | null;
  while ((objMatch = rePh.exec(strSql)) !== null) {
    setPh.add(objMatch[1]);
  }
  const arrUnused: string[] = [];
  const setSeen = new Set<string>();
  for (const obj of arrInputs) {
    const strId = (obj.strInputId ?? '').trim();
    if (!strId || setSeen.has(strId)) continue;
    setSeen.add(strId);
    if ((obj.strInputFormat ?? '').trim() === 'none') continue;
    if (!setPh.has(strId)) arrUnused.push(strId);
  }
  return arrUnused;
};

const fnResolveSlotsForSet = (objSet: TSetLike): TSlotLike[] => {
  if (Array.isArray(objSet.arrInputs) && objSet.arrInputs.length > 0) {
    return objSet.arrInputs;
  }
  const strId = (objSet.strInputId ?? '').trim();
  if (!strId && !(objSet.strInputFormat ?? '').trim()) return [];
  return [{
    strInputId: strId || 'items',
    strInputFormat: objSet.strInputFormat || 'item_number',
  }];
};

/** 세트 배열 슬롯↔SQL 정합 — 저장/API 검증용 */
export const fnValidateSetsSlotSqlConsistency = (arrSets: TSetLike[]): TSlotSqlIssue[] => {
  const arrIssues: TSlotSqlIssue[] = [];
  arrSets.forEach((objSet, nSetIdx) => {
    const strSql = (objSet.strQueryTemplate ?? '').trim();
    if (!strSql) return;
    const arrInputs = fnResolveSlotsForSet(objSet);
    const arrOrphans = fnFindOrphanInputPlaceholdersInSql(strSql, arrInputs);
    if (arrOrphans.length > 0) {
      arrIssues.push({
        nSetIdx,
        strKind: 'orphan',
        arrIds: arrOrphans,
        strMessage:
          `쿼리 세트 ${nSetIdx + 1}: 쿼리 템플릿에 ${arrOrphans.map((id) => `{{${id}}}`).join(', ')}가 남아 있습니다. 쿼리 또는 입력을 수정하세요.`,
      });
    }
    const arrUnused = fnFindUnusedSlotIdsInSql(strSql, arrInputs);
    if (arrUnused.length > 0) {
      arrIssues.push({
        nSetIdx,
        strKind: 'unused',
        arrIds: arrUnused,
        strMessage:
          `쿼리 세트 ${nSetIdx + 1}: 입력 ID ${arrUnused.map((id) => `"${id}"`).join(', ')}가 쿼리에 없습니다. 쿼리 또는 입력을 수정하세요.`,
      });
    }
  });
  return arrIssues;
};

/** 단일 쿼리 모드(레거시) 검증 */
export const fnValidateSingleSlotSqlConsistency = (
  strQueryTemplate: string,
  strInputId?: string,
  strInputFormat?: string,
): TSlotSqlIssue[] =>
  fnValidateSetsSlotSqlConsistency([{
    strQueryTemplate,
    strInputId,
    strInputFormat,
  }]).map((obj) => ({
    ...obj,
    strMessage: obj.strMessage.replace(/^세트 1: /, ''),
  }));

/** API/토스트용 첫 메시지 */
export const fnFirstSlotSqlConsistencyMessage = (arrIssues: TSlotSqlIssue[]): string | null =>
  arrIssues[0]?.strMessage ?? null;
