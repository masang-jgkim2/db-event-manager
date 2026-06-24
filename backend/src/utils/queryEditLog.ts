import type { IEventInstance } from '../data/eventInstances';
import type { IQueryTemplateItem } from '../data/events';

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
  if (objBefore.arrSetChanges?.length) {
    const arrTargets = obj.arrExecutionTargets ?? [];
    const arrOut = objBefore.arrSetChanges.map((chg) => {
      const strAfter = fnNorm(arrTargets[chg.nSetIndex]?.strQuery ?? '');
      return { ...chg, strAfter };
    }).filter((c) => c.strBefore !== c.strAfter);
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
    (s) => (s.strQueryTemplate ?? '').trim() && s.nDbConnectionId,
  ) ?? [];
  if (arrSets.length) {
    return {
      strGeneratedQuery: arrSets[0]?.strQueryTemplate ?? '',
      arrExecutionTargets: arrSets.map((s) => ({
        nDbConnectionId: s.nDbConnectionId,
        strQuery: s.strQueryTemplate ?? '',
      })),
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
    const arrSets = obj.arrQueryTemplates?.filter(
      (s) => (s.strQueryTemplate ?? '').trim() && s.nDbConnectionId,
    ) ?? [];
    if (arrSets.length) {
      return JSON.stringify(arrSets.map((s) => ({
        nDbConnectionId: s.nDbConnectionId,
        strDefaultItems: (s.strDefaultItems ?? '').trim(),
        strQueryTemplate: fnNorm(s.strQueryTemplate ?? ''),
      })));
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
