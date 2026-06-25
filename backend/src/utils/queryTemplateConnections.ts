import type { IDbConnection } from '../types';
import { fnConnectionMatchesServiceScope, fnFindConnectionById } from '../data/dbConnections';

/** 템플릿 세트 — QA/LIVE 연결 DB (레거시 nDbConnectionId → QA) */
export interface IQueryTemplateConnFields {
  nQaDbConnectionId: number;
  nLiveDbConnectionId: number;
  /** @deprecated nQaDbConnectionId 로 이관 */
  nDbConnectionId?: number;
}

/** 인스턴스 실행 대상 — QA/LIVE 연결 DB 스냅샷 */
export interface IExecutionTargetConnFields {
  nQaDbConnectionId: number;
  nLiveDbConnectionId: number;
  nDbConnectionId?: number;
}

export const fnNormalizeQueryTemplateConnFields = <T extends IQueryTemplateConnFields>(
  raw: Partial<T>,
): T => {
  const nQa = Number(raw.nQaDbConnectionId ?? raw.nDbConnectionId) || 0;
  const nLive = Number(raw.nLiveDbConnectionId) || 0;
  return {
    ...raw,
    nQaDbConnectionId: nQa,
    nLiveDbConnectionId: nLive,
  } as T;
};

export const fnNormalizeExecutionTargetConnFields = <T extends IExecutionTargetConnFields & { strQuery?: string }>(
  raw: Partial<T>,
): T => {
  const nQa = Number(raw.nQaDbConnectionId ?? raw.nDbConnectionId) || 0;
  const nLive = Number(raw.nLiveDbConnectionId) || 0;
  return {
    ...raw,
    nQaDbConnectionId: nQa,
    nLiveDbConnectionId: nLive,
    strQuery: raw.strQuery ?? '',
  } as T;
};

/** 실행 env에 맞는 접속 id */
export const fnGetConnIdForDeployEnv = (
  objFields: IExecutionTargetConnFields,
  strEnv: 'qa' | 'live',
): number => {
  const objNorm = fnNormalizeExecutionTargetConnFields(objFields);
  return strEnv === 'qa' ? objNorm.nQaDbConnectionId : objNorm.nLiveDbConnectionId;
};

/** QA 접속과 동일 DB명·kind·서비스의 LIVE 활성 접속 */
export const fnFindLivePairForQaConnection = (
  arrConnections: readonly IDbConnection[],
  objQa: IDbConnection,
): IDbConnection | undefined =>
  arrConnections.find(
    (c) =>
      c.nProductId === objQa.nProductId &&
      c.strEnv === 'live' &&
      c.bIsActive &&
      (c.strKind ?? 'GAME') === (objQa.strKind ?? 'GAME') &&
      c.strDatabase.trim() === objQa.strDatabase.trim() &&
      fnConnectionMatchesServiceScope(c, objQa.strServiceAbbr, objQa.nServiceId),
  );

/** 템플릿·인스턴스 공통 — QA/LIVE 접속 행 검증 */
export const fnValidateQaLiveConnectionPair = (
  nProductId: number,
  nQaId: number,
  nLiveId: number,
): string | null => {
  if (!nQaId) return 'QA 연결 DB를 선택해주세요.';
  if (!nLiveId) return 'LIVE 연결 DB를 선택해주세요.';
  const objQa = fnFindConnectionById(nQaId);
  const objLive = fnFindConnectionById(nLiveId);
  if (!objQa || objQa.nProductId !== nProductId) {
    return `QA 연결 DB(#${nQaId})가 선택한 프로덕트와 일치하지 않습니다.`;
  }
  if (!objLive || objLive.nProductId !== nProductId) {
    return `LIVE 연결 DB(#${nLiveId})가 선택한 프로덕트와 일치하지 않습니다.`;
  }
  if (!objQa.bIsActive) return `QA 연결 DB(#${nQaId})가 비활성 상태입니다.`;
  if (!objLive.bIsActive) return `LIVE 연결 DB(#${nLiveId})가 비활성 상태입니다.`;
  if (objQa.strEnv !== 'qa') return `QA 연결 DB(#${nQaId})는 QA 환경 접속이어야 합니다.`;
  if (objLive.strEnv !== 'live') return `LIVE 연결 DB(#${nLiveId})는 LIVE 환경 접속이어야 합니다.`;
  const strKindQa = objQa.strKind ?? 'GAME';
  const strKindLive = objLive.strKind ?? 'GAME';
  if (strKindQa !== strKindLive) {
    return `QA·LIVE 연결 DB의 종류가 일치해야 합니다 (${strKindQa} / ${strKindLive}).`;
  }
  return null;
};
