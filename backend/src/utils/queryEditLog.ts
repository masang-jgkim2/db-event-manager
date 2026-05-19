import type { IEventInstance } from '../data/eventInstances';

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
