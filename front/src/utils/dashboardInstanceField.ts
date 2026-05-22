import type { IEventInstance, TEventStatus } from '../types';

/** IEventInstance 에서 점 경로로 값 조회 (예: objCreator.strDisplayName) */
export function fnGetInstanceValueByPath(objInstance: IEventInstance, strPath: string): unknown {
  const arrParts = strPath.split('.');
  let cur: unknown = objInstance;
  for (const strPart of arrParts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[strPart];
  }
  return cur;
}

export function fnIsEventStatus(str: string): str is TEventStatus {
  return typeof str === 'string' && str.length > 0;
}
