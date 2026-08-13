import type { IEventInstance } from '../data/eventInstances';
import type { IQueryTemplateItem } from '../data/events';
import { fnNormalizeQueryTemplateConnFields } from './queryTemplateConnections';

/** DBA 쿼리 직접 수정 이력 — 진행 로그 diff 표시용 */
export interface IQueryEditLog {
  strBefore?: string;
  strAfter?: string;
  arrSetChanges?: Array<{
    nSetIndex: number;
    strBefore: string;
    strAfter: string;
  }>;
}

const fnNorm = (str: string): string => str.replace(/\r\n/g, '\n');

/**
 * 세트 SQL 배열 diff.
 * - 개수 동일: 인덱스 정렬 — 본문만 바뀌면 replace 1건 (삭제+추가로 쪼개지 않음, #369)
 * - 개수 상이: LCS — 중간 세트 삭제 시 인덱스 밀림 노이즈 제거
 */
const fnDiffSqlSets = (
  arrBefore: string[],
  arrAfter: string[],
): NonNullable<IQueryEditLog['arrSetChanges']> => {
  const nB = arrBefore.length;
  const nA = arrAfter.length;

  if (nB === nA) {
    const arrAligned: NonNullable<IQueryEditLog['arrSetChanges']> = [];
    for (let nIdx = 0; nIdx < nB; nIdx++) {
      if (arrBefore[nIdx] !== arrAfter[nIdx]) {
        arrAligned.push({
          nSetIndex: nIdx,
          strBefore: arrBefore[nIdx],
          strAfter: arrAfter[nIdx],
        });
      }
    }
    return arrAligned;
  }

  const arrDp: number[][] = Array.from({ length: nB + 1 }, () => Array(nA + 1).fill(0));
  for (let i = nB - 1; i >= 0; i--) {
    for (let j = nA - 1; j >= 0; j--) {
      arrDp[i][j] = arrBefore[i] === arrAfter[j]
        ? arrDp[i + 1][j + 1] + 1
        : Math.max(arrDp[i + 1][j], arrDp[i][j + 1]);
    }
  }
  const arrOut: NonNullable<IQueryEditLog['arrSetChanges']> = [];
  let i = 0;
  let j = 0;
  while (i < nB && j < nA) {
    if (arrBefore[i] === arrAfter[j]) {
      i++;
      j++;
      continue;
    }
    if (arrDp[i + 1][j] >= arrDp[i][j + 1]) {
      arrOut.push({ nSetIndex: i, strBefore: arrBefore[i], strAfter: '' });
      i++;
    } else {
      arrOut.push({ nSetIndex: j, strBefore: '', strAfter: arrAfter[j] });
      j++;
    }
  }
  while (i < nB) {
    arrOut.push({ nSetIndex: i, strBefore: arrBefore[i], strAfter: '' });
    i++;
  }
  while (j < nA) {
    arrOut.push({ nSetIndex: j, strBefore: '', strAfter: arrAfter[j] });
    j++;
  }
  return arrOut;
};

/** 수정 직전 쿼리 스냅샷 */
export const fnSnapshotQueryBefore = (
  obj: Pick<IEventInstance, 'strGeneratedQuery' | 'arrExecutionTargets'>,
): IQueryEditLog => {
  const arrTargets = obj.arrExecutionTargets;
  if (arrTargets?.length) {
    return {
      arrSetChanges: arrTargets.map((t, nSetIndex) => ({
        nSetIndex,
        strBefore: fnNorm(t.strQuery ?? ''),
        strAfter: '',
      })),
    };
  }
  return { strBefore: fnNorm(obj.strGeneratedQuery ?? ''), strAfter: '' };
};

/** 수정 후 diff — 변경 없으면 null */
export const fnBuildQueryEditLog = (
  objBefore: IQueryEditLog,
  obj: Pick<IEventInstance, 'strGeneratedQuery' | 'arrExecutionTargets'>,
): IQueryEditLog | null => {
  const arrTargets = obj.arrExecutionTargets ?? [];
  const bHadSets = (objBefore.arrSetChanges?.length ?? 0) > 0;
  const bHasSets = arrTargets.length > 0;

  if (bHadSets || bHasSets) {
    const arrBeforeSql = (objBefore.arrSetChanges ?? []).map((c) => fnNorm(c.strBefore ?? ''));
    const arrAfterSql = arrTargets.map((t) => fnNorm(t.strQuery ?? ''));
    const arrOut = fnDiffSqlSets(arrBeforeSql, arrAfterSql);
    return arrOut.length > 0 ? { arrSetChanges: arrOut } : null;
  }

  const strAfter = fnNorm(obj.strGeneratedQuery ?? '');
  const strBefore = fnNorm(objBefore.strBefore ?? '');
  if (strBefore === strAfter) return null;
  return { strBefore, strAfter };
};

export type TTemplateQueryFields = {
  strQueryTemplate?: string;
  strDefaultItems?: string;
  arrQueryTemplates?: IQueryTemplateItem[];
};

const fnTemplateToInstanceQueryShape = (
  obj: TTemplateQueryFields,
): Pick<IEventInstance, 'strGeneratedQuery' | 'arrExecutionTargets'> => {
  const arrSets = obj.arrQueryTemplates?.filter(
    (s) => {
      const objNorm = fnNormalizeQueryTemplateConnFields(s);
      return (s.strQueryTemplate ?? '').trim() && objNorm.nQaDbConnectionId && objNorm.nLiveDbConnectionId;
    },
  ) ?? [];
  if (arrSets.length) {
    return {
      strGeneratedQuery: arrSets[0]?.strQueryTemplate ?? '',
      arrExecutionTargets: arrSets.map((s) => {
        const objNorm = fnNormalizeQueryTemplateConnFields(s);
        return {
          nQaDbConnectionId: objNorm.nQaDbConnectionId,
          nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
          strQuery: s.strQueryTemplate ?? '',
        };
      }),
    };
  }
  return { strGeneratedQuery: obj.strQueryTemplate ?? '' };
};

/** 템플릿 쿼리 수정 직전 스냅샷 */
export const fnSnapshotTemplateQueryBefore = (obj: TTemplateQueryFields): IQueryEditLog =>
  fnSnapshotQueryBefore(fnTemplateToInstanceQueryShape(obj));

/** 템플릿 쿼리 diff — 변경 없으면 null */
export const fnBuildTemplateQueryEditLog = (
  objBefore: IQueryEditLog,
  obj: TTemplateQueryFields,
): IQueryEditLog | null => fnBuildQueryEditLog(objBefore, fnTemplateToInstanceQueryShape(obj));

/** 쿼리·세트 본문 변경 여부 (D2 재승인·리뷰 중 잠금 판별) */
export const fnTemplateQueryBodyChanged = (
  objBefore: TTemplateQueryFields,
  objAfter: TTemplateQueryFields,
): boolean => {
  const fnKey = (obj: TTemplateQueryFields): string => {
    const arrSets = obj.arrQueryTemplates?.filter((s) => {
      const objNorm = fnNormalizeQueryTemplateConnFields(s);
      return (s.strQueryTemplate ?? '').trim() && objNorm.nQaDbConnectionId && objNorm.nLiveDbConnectionId;
    }) ?? [];
    if (arrSets.length) {
      return JSON.stringify(arrSets.map((s) => {
        const objNorm = fnNormalizeQueryTemplateConnFields(s);
        return {
          nQaDbConnectionId: objNorm.nQaDbConnectionId,
          nLiveDbConnectionId: objNorm.nLiveDbConnectionId,
          strInputId: (s.strInputId ?? 'items').trim() || 'items',
          strInputFormat: (s.strInputFormat ?? '').trim(),
          strDefaultItems: (s.strDefaultItems ?? '').trim(),
          strQueryTemplate: fnNorm(s.strQueryTemplate ?? ''),
        };
      }));
    }
    return JSON.stringify({
      strDefaultItems: (obj.strDefaultItems ?? '').trim(),
      strQueryTemplate: fnNorm(obj.strQueryTemplate ?? ''),
    });
  };
  return fnKey(objBefore) !== fnKey(objAfter);
};

export const fnMergeTemplateQueryFromBody = (
  objTpl: TTemplateQueryFields,
  body: Record<string, unknown>,
): TTemplateQueryFields => ({
  strQueryTemplate: body.strQueryTemplate !== undefined ? String(body.strQueryTemplate) : objTpl.strQueryTemplate,
  strDefaultItems: body.strDefaultItems !== undefined ? String(body.strDefaultItems) : objTpl.strDefaultItems,
  arrQueryTemplates: body.arrQueryTemplates !== undefined
    ? (body.arrQueryTemplates as IQueryTemplateItem[])
    : objTpl.arrQueryTemplates,
});

export const ARR_TEMPLATE_QUERY_BODY_KEYS = ['strDefaultItems', 'strQueryTemplate', 'arrQueryTemplates'] as const;

export const fnBodyHasTemplateQueryFields = (body: Record<string, unknown>): boolean =>
  ARR_TEMPLATE_QUERY_BODY_KEYS.some((k) => body[k] !== undefined);
