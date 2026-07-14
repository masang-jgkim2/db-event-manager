import type { IEventTemplate, IDbConnection, IQueryTemplateItem, IService, TDbConnectionKind } from '../types';
import { fnFormatDbConnectionCountryPlatform } from './countryPlatformLabel';
import { fnNormalizeQuerySetInputFields } from './querySetInput';

/** product.arrServices 조회용 — arrServices 생략 가능 */
export type TProductServiceLookup = {
  nId: number;
  arrServices?: ReadonlyArray<Pick<IService, 'nServiceId' | 'strAbbr'>>;
};

/** 접속 행 서비스 약자 — strServiceAbbr 없으면 nServiceId→product.arrServices */
export const fnResolveConnectionServiceAbbr = (
  objConn: Pick<IDbConnection, 'strServiceAbbr' | 'nServiceId' | 'nProductId'>,
  arrProducts?: readonly TProductServiceLookup[],
): string => {
  const strAbbr = fnNormalizeServiceAbbr(objConn.strServiceAbbr);
  if (strAbbr) return strAbbr;
  const nSvcId = Number(objConn.nServiceId);
  if (nSvcId > 0 && arrProducts?.length) {
    const objProd = arrProducts.find((p) => p.nId === objConn.nProductId);
    const objSvc = objProd?.arrServices?.find((s) => s.nServiceId === nSvcId);
    if (objSvc?.strAbbr) return fnNormalizeServiceAbbr(objSvc.strAbbr);
  }
  return '';
};

/** 템플릿 세트 연결 DB → 모달 서비스 필터 복원 (세트가 동일 서비스 1종이면 해당 약자) */
export const fnDeriveTemplateConnFilterAbbr = (
  objTemplate: Pick<IEventTemplate, 'arrQueryTemplates'>,
  arrConnections: IDbConnection[],
  arrProducts?: readonly TProductServiceLookup[],
): string | undefined => {
  const arrSets =
    objTemplate.arrQueryTemplates?.filter((s) => {
      const objNorm = fnNormalizeQueryTemplateItem(s);
      return objNorm.nQaDbConnectionId > 0;
    }) ?? [];
  if (!arrSets.length) return undefined;
  const setAbbrs = new Set<string>();
  for (const s of arrSets) {
    const objConn = arrConnections.find((c) => c.nId === fnNormalizeQueryTemplateItem(s).nQaDbConnectionId);
    if (!objConn) continue;
    const strResolved = fnResolveConnectionServiceAbbr(objConn, arrProducts);
    if (strResolved) setAbbrs.add(strResolved);
  }
  if (setAbbrs.size === 1) return [...setAbbrs][0];
  return undefined;
};

/** 쿼리 템플릿 세트 연결 DB에서 서비스 구분 약자 목록 (중복 제거, 빈값=전체) */
export const fnListTemplateServiceScopeAbbrs = (
  objTemplate: Pick<IEventTemplate, 'arrQueryTemplates'>,
  arrConnections: IDbConnection[],
  arrProducts?: readonly TProductServiceLookup[],
): string[] => {
  const arrSets =
    objTemplate.arrQueryTemplates?.filter(
      (s) => fnNormalizeQueryTemplateItem(s).nQaDbConnectionId > 0 && (s.strQueryTemplate ?? '').trim(),
    ) ?? [];
  if (!arrSets.length) return [];
  const setSeen = new Set<string>();
  const arrOut: string[] = [];
  for (const s of arrSets) {
    const objConn = arrConnections.find((c) => c.nId === fnNormalizeQueryTemplateItem(s).nQaDbConnectionId);
    if (!objConn) continue;
    const strKey = fnResolveConnectionServiceAbbr(objConn, arrProducts);
    const strDedupe = strKey || (objConn.nServiceId ? `#${objConn.nServiceId}` : '');
    if (!strDedupe || setSeen.has(strDedupe)) continue;
    setSeen.add(strDedupe);
    arrOut.push(strKey || strDedupe);
  }
  return arrOut;
};

export const fnFormatTemplateServiceScopeCell = (
  objTemplate: Pick<IEventTemplate, 'arrQueryTemplates'>,
  arrConnections: IDbConnection[],
  arrProducts?: readonly TProductServiceLookup[],
): string => {
  const arrAbbrs = fnListTemplateServiceScopeAbbrs(objTemplate, arrConnections, arrProducts);
  if (!arrAbbrs.length) return '-';
  return arrAbbrs
    .map((a) => (a.startsWith('#') ? a : fnFormatDbConnectionCountryPlatform(a)))
    .join(', ');
};

export const fnNormalizeServiceAbbr = (str?: string | null): string => (str ?? '').trim();

/** CC↔CC/KR, FH↔FH/KR 등 프로덕트·접속 약자 마이그레이션 호환 */
export const fnServiceAbbrsCompatible = (strConnAbbr: string, strInstAbbr: string): boolean => {
  const strA = fnNormalizeServiceAbbr(strConnAbbr);
  const strB = fnNormalizeServiceAbbr(strInstAbbr);
  if (!strA || !strB) return false;
  if (strA === strB) return true;
  return strB.startsWith(`${strA}/`) || strA.startsWith(`${strB}/`);
};

/** 접속 행이 이벤트 Step2 서비스 범위와 호환 (nServiceId 우선, abbr fallback) */
export const fnConnectionMatchesServiceScope = (
  objConn: IDbConnection,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): boolean => {
  const nInstId = Number(nServiceId) || 0;
  const nConnId = Number(objConn.nServiceId) || 0;
  if (nInstId > 0 && nConnId > 0) return nConnId === nInstId;

  const strConnSvc = fnNormalizeServiceAbbr(objConn.strServiceAbbr);
  const strInstSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  if (!strInstSvc && nInstId <= 0) return !strConnSvc || strConnSvc === strInstSvc;
  if (!strConnSvc) return true;
  if (!strInstSvc) return true;
  return fnServiceAbbrsCompatible(strConnSvc, strInstSvc);
};

/** 프로덕트·서비스·환경 기준 활성 접속 존재 (종류 무관) */
export const fnHasEnvConnectionForService = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strServiceAbbr: string,
  strEnv: 'qa' | 'live',
  nServiceId?: number | null,
): boolean =>
  arrConnections.some(
    (c) =>
      c.nProductId === nProductId &&
      c.strEnv === strEnv &&
      c.bIsActive &&
      fnConnectionMatchesServiceScope(c, strServiceAbbr, nServiceId),
  );

/** 프로덕트·서비스·환경·종류(GAME/WEB/LOG) 기준 활성 접속 존재 */
export const fnHasEnvConnectionForKindAndService = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strServiceAbbr: string,
  strEnv: 'qa' | 'live',
  strKind: TDbConnectionKind,
  nServiceId?: number | null,
): boolean =>
  arrConnections.some(
    (c) =>
      c.nProductId === nProductId &&
      c.strEnv === strEnv &&
      (c.strKind ?? 'GAME') === strKind &&
      c.bIsActive &&
      fnConnectionMatchesServiceScope(c, strServiceAbbr, nServiceId),
  );

/** 서비스 범위에 QA 또는 LIVE 접속이 하나라도 있는지 */
export const fnServiceHasAnyDeployConnection = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strServiceAbbr: string,
  nServiceId?: number | null,
): boolean =>
  fnHasEnvConnectionForService(arrConnections, nProductId, strServiceAbbr, 'qa', nServiceId) ||
  fnHasEnvConnectionForService(arrConnections, nProductId, strServiceAbbr, 'live', nServiceId);

export const fnFindConnectionById = (
  arrConnections: IDbConnection[],
  nId: number,
): IDbConnection | undefined => arrConnections.find((c) => c.nId === nId);

/** 템플릿 세트 — QA/LIVE id + 입력 ID·형식 정규화 */
export const fnNormalizeQueryTemplateItem = (
  raw: Partial<IQueryTemplateItem>,
  strTemplateFormatFallback: string = 'item_number',
): IQueryTemplateItem => {
  const objInput = fnNormalizeQuerySetInputFields(raw, strTemplateFormatFallback);
  return {
    nQaDbConnectionId: Number(raw.nQaDbConnectionId ?? raw.nDbConnectionId) || 0,
    nLiveDbConnectionId: Number(raw.nLiveDbConnectionId) || 0,
    strInputId: objInput.strInputId,
    strInputFormat: objInput.strInputFormat,
    strDefaultItems: raw.strDefaultItems,
    strQueryTemplate: raw.strQueryTemplate ?? '',
  };
};

export const fnNormalizeExecutionTargetItem = (
  raw: Partial<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; nDbConnectionId?: number; strQuery: string }>,
): { nQaDbConnectionId: number; nLiveDbConnectionId: number; strQuery: string } => ({
  nQaDbConnectionId: Number(raw.nQaDbConnectionId ?? raw.nDbConnectionId) || 0,
  nLiveDbConnectionId: Number(raw.nLiveDbConnectionId) || 0,
  strQuery: raw.strQuery ?? '',
});

/** 템플릿 세트 유효성 — QA/LIVE id + 쿼리 본문 */
export const fnIsValidQueryTemplateSet = (s: Partial<IQueryTemplateItem>): boolean => {
  const objNorm = fnNormalizeQueryTemplateItem(s);
  return Boolean((s.strQueryTemplate ?? '').trim() && objNorm.nQaDbConnectionId > 0 && objNorm.nLiveDbConnectionId > 0);
};

/** 명시된 접속 id가 프로덕트·env·서비스 범위에서 유효한지 */
export const fnIsExplicitEnvConnectionValid = (
  arrConnections: IDbConnection[],
  nProductId: number,
  nConnId: number,
  strEnv: 'qa' | 'live',
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): boolean => {
  if (!nConnId) return false;
  const objConn = fnFindConnectionById(arrConnections, nConnId);
  return Boolean(
    objConn &&
    objConn.nProductId === nProductId &&
    objConn.strEnv === strEnv &&
    objConn.bIsActive &&
    fnConnectionMatchesServiceScope(objConn, strServiceAbbr, nServiceId),
  );
};

/** 실행 대상 탭 라벨 — QA/LIVE 연결 id */
export const fnFormatExecutionTargetConnLabel = (
  raw: Partial<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; nDbConnectionId?: number }>,
): string => {
  const obj = fnNormalizeExecutionTargetItem({ ...raw, strQuery: '' });
  if (obj.nQaDbConnectionId && obj.nLiveDbConnectionId) {
    return ` (QA #${obj.nQaDbConnectionId} / LIVE #${obj.nLiveDbConnectionId})`;
  }
  if (obj.nQaDbConnectionId) return ` (QA #${obj.nQaDbConnectionId})`;
  return '';
};

/** QA 접속과 동일 DB명·kind·서비스 LIVE 활성 접속 */
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

/** env별 연결 DB Select 옵션 */
export const fnFilterConnectionsForTemplatePickerByEnv = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strEnv: 'qa' | 'live',
  strServiceAbbr?: string | null,
  arrProducts?: readonly TProductServiceLookup[],
): IDbConnection[] => {
  const strSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  const objProduct = arrProducts?.find((p) => p.nId === nProductId);
  const nFilterSvcId =
    strSvc && objProduct?.arrServices?.length
      ? objProduct.arrServices.find((s) => fnServiceAbbrsCompatible(s.strAbbr, strSvc))?.nServiceId
      : undefined;
  const bHasServiceFilter = Boolean(strSvc) || (nFilterSvcId != null && nFilterSvcId > 0);
  return arrConnections
    .filter(
      (c) =>
        c.nProductId === nProductId &&
        c.strEnv === strEnv &&
        c.bIsActive &&
        (bHasServiceFilter
          ? fnConnectionMatchesServiceScope(c, strSvc || undefined, nFilterSvcId)
          : true),
    )
    .sort((a, b) => {
      const strKa = `${a.strKind ?? 'GAME'}|${a.strHost}|${a.strDatabase}`;
      const strKb = `${b.strKind ?? 'GAME'}|${b.strHost}|${b.strDatabase}`;
      return strKa.localeCompare(strKb);
    });
};

/** 프로덕트+환경+종류+서비스 범위 기준 활성 접속 1건 (서비스 전용 → 공통 fallback) */
export const fnFindActiveConnectionByKindAndService = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  strKind: TDbConnectionKind,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): IDbConnection | undefined => {
  const strSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  const fnMatches = (c: IDbConnection) =>
    c.nProductId === nProductId &&
    c.strEnv === strEnv &&
    (c.strKind ?? 'GAME') === strKind &&
    c.bIsActive &&
    fnConnectionMatchesServiceScope(c, strSvc, nServiceId);

  if (strSvc || (nServiceId != null && nServiceId > 0)) {
    if (nServiceId != null && nServiceId > 0) {
      const objById = arrConnections.find(
        (c) => fnMatches(c) && Number(c.nServiceId) === Number(nServiceId),
      );
      if (objById) return objById;
    }
    const objExact = arrConnections.find(
      (c) => fnMatches(c) && fnNormalizeServiceAbbr(c.strServiceAbbr) === strSvc,
    );
    if (objExact) return objExact;
    const objCompat = arrConnections.find((c) => {
      const strConn = fnNormalizeServiceAbbr(c.strServiceAbbr);
      return fnMatches(c) && strConn && strConn !== strSvc && fnServiceAbbrsCompatible(strConn, strSvc);
    });
    if (objCompat) return objCompat;
    return arrConnections.find((c) => fnMatches(c) && !fnNormalizeServiceAbbr(c.strServiceAbbr));
  }
  return arrConnections.find((c) => fnMatches(c) && !fnNormalizeServiceAbbr(c.strServiceAbbr));
};

/** 이벤트 생성·실행 시 QA/LIVE 접속 해석 (백엔드 fnResolveExecuteConnection과 동일 규칙) */
export const fnResolveExecuteConnection = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strEnv: 'qa' | 'live',
  nDbConnectionId?: number | null,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): IDbConnection | undefined => {
  if (nDbConnectionId != null && nDbConnectionId > 0) {
    const objTemplateConn = fnFindConnectionById(arrConnections, nDbConnectionId);
    if (!objTemplateConn || objTemplateConn.nProductId !== nProductId) return undefined;
    const strKind = objTemplateConn.strKind ?? 'GAME';
    if (
      objTemplateConn.strEnv === strEnv &&
      objTemplateConn.bIsActive &&
      fnConnectionMatchesServiceScope(objTemplateConn, strServiceAbbr, nServiceId)
    ) {
      return objTemplateConn;
    }
    return fnFindActiveConnectionByKindAndService(
      arrConnections,
      nProductId,
      strEnv,
      strKind,
      strServiceAbbr,
      nServiceId,
    );
  }
  return fnFindActiveConnectionByKindAndService(
    arrConnections,
    nProductId,
    strEnv,
    'GAME',
    strServiceAbbr,
    nServiceId,
  );
};

export const fnFormatConnectionEndpoint = (objConn: IDbConnection): string =>
  `${objConn.strHost}:${objConn.nPort}/${objConn.strDatabase}`;

export type TInstanceConnectionPreviewRow = {
  nSetIndex: number;
  strKind: TDbConnectionKind;
  strEnv: 'qa' | 'live';
  objConn?: IDbConnection;
};

/** Step4 QA/LIVE 접속 미리보기 — 템플릿 세트에 명시된 QA/LIVE id */
export const fnBuildInstanceConnectionPreview = (
  arrConnections: IDbConnection[],
  nProductId: number,
  _strServiceAbbr: string,
  arrDeployScope: Array<'qa' | 'live'>,
  arrSets: Array<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; nDbConnectionId?: number }>,
  _nServiceId?: number | null,
): TInstanceConnectionPreviewRow[] => {
  const arrScope = arrDeployScope.filter((e): e is 'qa' | 'live' => e === 'qa' || e === 'live');
  const arrRows: TInstanceConnectionPreviewRow[] = [];
  if (!arrScope.length) return arrRows;

  if (!arrSets.length) {
    for (const strEnv of arrScope) {
      arrRows.push({
        nSetIndex: 0,
        strKind: 'GAME',
        strEnv,
        objConn: fnResolveExecuteConnection(arrConnections, nProductId, strEnv, null, _strServiceAbbr, _nServiceId),
      });
    }
    return arrRows;
  }

  arrSets.forEach((s, nIdx) => {
    const objNorm = fnNormalizeQueryTemplateItem(s);
    const objQaTpl = fnFindConnectionById(arrConnections, objNorm.nQaDbConnectionId);
    const strKind = objQaTpl?.strKind ?? 'GAME';
    for (const strEnv of arrScope) {
      const nConnId = strEnv === 'qa' ? objNorm.nQaDbConnectionId : objNorm.nLiveDbConnectionId;
      const objConn = fnFindConnectionById(arrConnections, nConnId);
      arrRows.push({
        nSetIndex: nIdx,
        strKind,
        strEnv,
        objConn: objConn?.nProductId === nProductId && objConn.strEnv === strEnv && objConn.bIsActive
          ? objConn
          : undefined,
      });
    }
  });
  return arrRows;
};

const OBJ_ENV_PICK_PRIORITY: Record<string, number> = { qa: 0, live: 1, dev: 2 };

/** 쿼리 템플릿 연결 DB Select — 프로덕트·서비스 필터 후 종류·호스트·DB명별 행 (동일 endpoint는 QA 우선 1건) */
export const fnFilterConnectionsForTemplatePicker = (
  arrConnections: IDbConnection[],
  nProductId: number,
  strServiceAbbr?: string | null,
  arrProducts?: readonly TProductServiceLookup[],
): IDbConnection[] => {
  const strSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  const objProduct = arrProducts?.find((p) => p.nId === nProductId);
  const nFilterSvcId =
    strSvc && objProduct?.arrServices?.length
      ? objProduct.arrServices.find((s) => fnServiceAbbrsCompatible(s.strAbbr, strSvc))?.nServiceId
      : undefined;
  const bHasServiceFilter = Boolean(strSvc) || (nFilterSvcId != null && nFilterSvcId > 0);
  const arrActive = arrConnections.filter(
    (c) =>
      c.nProductId === nProductId &&
      c.bIsActive &&
      (bHasServiceFilter
        ? fnConnectionMatchesServiceScope(c, strSvc || undefined, nFilterSvcId)
        : true),
  );
  const mapBest = new Map<string, IDbConnection>();
  for (const c of arrActive) {
    const strSvcKey =
      fnResolveConnectionServiceAbbr(c, arrProducts) ||
      (c.nServiceId ? `sid:${c.nServiceId}` : '_common');
    const strKey = `${strSvcKey}|${c.strKind ?? 'GAME'}|${c.strHost.trim()}|${c.strDatabase.trim()}`;
    const objExisting = mapBest.get(strKey);
    if (!objExisting) {
      mapBest.set(strKey, c);
      continue;
    }
    const nPri = OBJ_ENV_PICK_PRIORITY[c.strEnv] ?? 9;
    const nExistingPri = OBJ_ENV_PICK_PRIORITY[objExisting.strEnv] ?? 9;
    if (nPri < nExistingPri) mapBest.set(strKey, c);
  }
  return [...mapBest.values()].sort((a, b) => {
    const strKa = `${fnResolveConnectionServiceAbbr(a, arrProducts)}|${a.strKind ?? 'GAME'}|${a.strHost}`;
    const strKb = `${fnResolveConnectionServiceAbbr(b, arrProducts)}|${b.strKind ?? 'GAME'}|${b.strHost}`;
    return strKa.localeCompare(strKb);
  });
};

/** 연결 DB Select — 필터 결과 + 이미 선택된 접속(다른 env 등) 병합 */
export const fnMergeTemplatePickerConnections = (
  arrFiltered: IDbConnection[],
  arrAllConnections: IDbConnection[],
  arrSelectedConnIds: number[],
  nProductId: number,
): IDbConnection[] => {
  const mapOut = new Map<number, IDbConnection>();
  for (const c of arrFiltered) mapOut.set(c.nId, c);
  for (const nId of arrSelectedConnIds) {
    if (mapOut.has(nId)) continue;
    const objConn = arrAllConnections.find((c) => c.nId === nId && c.nProductId === nProductId);
    if (objConn) mapOut.set(nId, objConn);
  }
  return [...mapOut.values()].sort((a, b) => {
    const strKa = `${a.strEnv}|${a.strKind ?? 'GAME'}|${a.strHost}|${a.nId}`;
    const strKb = `${b.strEnv}|${b.strKind ?? 'GAME'}|${b.strHost}|${b.nId}`;
    return strKa.localeCompare(strKb);
  });
};

/** 백엔드 fnFindDuplicateDbConnection 과 동일 — 호스트·DB명까지 같을 때만 중복 */
export const fnFindDuplicateDbConnectionInList = (
  arrConnections: readonly IDbConnection[],
  objCriteria: {
    nProductId: number;
    strEnv: IDbConnection['strEnv'];
    strKind: TDbConnectionKind;
    strHost: string;
    strDatabase: string;
    strServiceAbbr?: string;
    nExcludeId?: number;
  },
  arrProducts?: readonly TProductServiceLookup[],
): IDbConnection | undefined => {
  const strHostNorm = objCriteria.strHost.trim();
  const strDbNorm = objCriteria.strDatabase.trim();
  if (!strHostNorm || !strDbNorm) return undefined;

  const strSvcNorm = fnNormalizeServiceAbbr(objCriteria.strServiceAbbr);
  return arrConnections.find((c) => {
    if (c.nId === objCriteria.nExcludeId) return false;
    if (c.nProductId !== objCriteria.nProductId) return false;
    if (c.strEnv !== objCriteria.strEnv) return false;
    if ((c.strKind ?? 'GAME') !== objCriteria.strKind) return false;
    if (c.strHost.trim() !== strHostNorm) return false;
    if (c.strDatabase.trim() !== strDbNorm) return false;
    return fnResolveConnectionServiceAbbr(c, arrProducts) === strSvcNorm;
  });
};
