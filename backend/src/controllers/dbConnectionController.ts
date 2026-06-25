import { Request, Response } from 'express';
import {
  arrDbConnections,
  fnCommitDbConnectionDeleteToMysql,
  fnCommitOneDbConnectionToMysql,
  fnFindDuplicateDbConnection,
  fnGetNextDbConnectionId,
  fnNormalizeServiceAbbr,
  fnRefreshDbConnectionByIdFromMysql,
  fnSaveDbConnections,
  fnReloadDbConnectionsFromDiskIfEmpty,
} from '../data/dbConnections';
import { arrProducts } from '../data/products';
import { arrEvents } from '../data/events';
import { arrEventInstances } from '../data/eventInstances';
import { IDbConnection } from '../types';
import { fnTestDbConnection } from '../db/dbManager';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnGetDbConnectionDeleteBlockReason } from '../db/mysqlRelationalSync';
import {
  fnResolveConnectionServiceFieldsForWrite,
  STR_SERVICE_ID_WRITE_REQUIRED,
} from '../utils/serviceId';
import { fnNormalizeExecutionTargetConnFields, fnNormalizeQueryTemplateConnFields } from '../utils/queryTemplateConnections';

const fnIsPermanentlyRemoved = (e: { bPermanentlyRemoved?: boolean } | undefined): boolean =>
  Boolean(e?.bPermanentlyRemoved);

const fnConnectionIdUsedInTemplateSet = (
  q: { nQaDbConnectionId?: number; nLiveDbConnectionId?: number; nDbConnectionId?: number },
  nId: number,
): boolean => {
  const objNorm = fnNormalizeQueryTemplateConnFields(q);
  return objNorm.nQaDbConnectionId === nId || objNorm.nLiveDbConnectionId === nId;
};

const fnConnectionIdUsedInExecutionTarget = (
  t: { nQaDbConnectionId?: number; nLiveDbConnectionId?: number; nDbConnectionId?: number },
  nId: number,
): boolean => {
  const objNorm = fnNormalizeExecutionTargetConnFields(t);
  return objNorm.nQaDbConnectionId === nId || objNorm.nLiveDbConnectionId === nId;
};

const fnGetDbConnectionDeleteBlockReasonFromMemory = (nDbConnectionId: number): string | null => {
  for (const objTpl of arrEvents) {
    if (objTpl.arrQueryTemplates?.some((q) => fnConnectionIdUsedInTemplateSet(q, nDbConnectionId))) {
      return '이 DB 접속 정보는 쿼리 템플릿에서 사용 중입니다. 쿼리 템플릿을 먼저 삭제하세요.';
    }
  }
  for (const inst of arrEventInstances) {
    if (fnIsPermanentlyRemoved(inst)) continue;
    if (inst.arrExecutionTargets?.some((t) => fnConnectionIdUsedInExecutionTarget(t, nDbConnectionId))) {
      return '이 DB 접속 정보는 이벤트 인스턴스에서 사용 중입니다. 이벤트를 영구 삭제한 뒤 다시 시도하세요.';
    }
  }
  return null;
};

const fnIsDbConnectionPersistConflict = (strMessage: string): boolean =>
  strMessage.includes('사용 중') || strMessage.includes('삭제할 수 없습니다');

const fnPersistDbConnectionRow = async (objConn: IDbConnection): Promise<void> => {
  fnSaveDbConnections();
  await fnCommitOneDbConnectionToMysql(objConn);
};

const fnPersistDbConnectionDelete = async (nId: number): Promise<void> => {
  fnSaveDbConnections();
  await fnCommitDbConnectionDeleteToMysql(nId);
};

const fnMysqlPersistErrorMessage = (err: unknown): string => {
  const strRaw = err instanceof Error ? err.message : String(err);
  if (/access denied|er_access_denied/i.test(strRaw)) {
    if (/using password: no|''@/i.test(strRaw)) {
      return (
        'db_connection 테이블 저장 실패입니다. 메타 DB(.env DATA_MYSQL_*) 계정을 확인하세요. ' +
        '(게임 DB 연결 테스트 오류와는 별개 — 연결 테스트는 화면 접속 정보 계정)'
      );
    }
    return (
      'db_connection 테이블 저장 실패입니다. DATA_MYSQL_* 계정에 dqpm 스키마 INSERT 권한을 확인하세요.'
    );
  }
  if (/unknown database/i.test(strRaw)) {
    return '메타 DB가 없습니다. DATA_MYSQL_DATABASE(dqpm) 스키마 생성을 요청하세요.';
  }
  if (/foreign key constraint|fk_eiet_dbconn|fk_etqs_dbconn/i.test(strRaw)) {
    return (
      '이 DB 접속 정보는 이벤트 인스턴스 또는 쿼리 템플릿에서 사용 중입니다. ' +
      '참조를 해제한 뒤 삭제하거나, 수정만 진행해 주세요.'
    );
  }
  if (/사용 중이라 삭제할 수 없습니다/.test(strRaw)) {
    return strRaw;
  }
  return `메타 DB 저장 실패: ${strRaw}`;
};

// DB 접속 정보 목록 조회
export const fnGetDbConnections = async (_req: Request, res: Response): Promise<void> => {
  try {
    fnReloadDbConnectionsFromDiskIfEmpty();
    const arrSafe = arrDbConnections.map((c) => {
      const strResolved =
        arrProducts.find((p) => p.nId === c.nProductId)?.strName ?? c.strProductName;
      return { ...c, strProductName: strResolved, strPassword: '••••••••' };
    });
    res.json({ bSuccess: true, arrDbConnections: arrSafe });
  } catch (error) {
    console.error('DB 접속 정보 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

const ARR_DB_KIND: IDbConnection['strKind'][] = ['GAME', 'WEB', 'LOG'];

const fnSanitizeDbConnectionForClient = (objConn: IDbConnection): IDbConnection => ({
  ...objConn,
  strPassword: '••••••••',
});

const fnResolveProductNameForConnection = (objConn: IDbConnection): IDbConnection => {
  const strResolved =
    arrProducts.find((p) => p.nId === objConn.nProductId)?.strName ?? objConn.strProductName;
  return { ...fnSanitizeDbConnectionForClient(objConn), strProductName: strResolved };
};

const fnValidateDbConnectionCredentials = (
  strUser: string | undefined,
  strPassword: string | undefined,
  bRequirePassword: boolean,
): string | null => {
  if (!(strUser ?? '').trim()) {
    return '사용자 계정을 입력해주세요.';
  }
  if (bRequirePassword && !(strPassword ?? '').trim()) {
    return '비밀번호를 입력해주세요.';
  }
  if ((strPassword ?? '').trim() === '••••••••') {
    return '비밀번호를 다시 입력해주세요.';
  }
  return null;
};

// 프로덕트에 정의된 DB 종류(mssql/mysql)와 접속 정보 일치 검사 (없는 프로덕트면 스킵)
const fnMismatchProductDbTypeMessage = (nProductId: number, strConnDbType: string): string | null => {
  const objProduct = arrProducts.find((p) => p.nId === nProductId);
  if (!objProduct) return null;
  if (objProduct.strDbType !== strConnDbType) {
    return `프로덕트「${objProduct.strName}」의 DB 종류는 ${objProduct.strDbType}입니다. 접속 DB 종류를 동일하게 맞춰주세요.`;
  }
  return null;
};

/** 등록·수정 — nServiceId만 (약자 단독 거부) */
const fnResolveServiceForConnectionWrite = (
  nProductId: number,
  nServiceId?: number | null,
  strServiceAbbr?: string | null,
): { nServiceId?: number; strServiceAbbr?: string } | { strError: string } => {
  const objProduct = arrProducts.find((p) => p.nId === nProductId);
  return fnResolveConnectionServiceFieldsForWrite(objProduct, nServiceId, strServiceAbbr);
};

// DB 접속 정보 추가
export const fnCreateDbConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nProductId, strKind, strEnv, strDbType,
      strHost, nPort, strDatabase, strUser, strPassword, strServiceAbbr, nServiceId,
    } = req.body as Partial<IDbConnection>;

    if (!nProductId || !strEnv || !strDbType || !strHost || !strDatabase) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 모두 입력해주세요.' });
      return;
    }
    const strMsgCred = fnValidateDbConnectionCredentials(strUser, strPassword, true);
    if (strMsgCred) {
      res.status(400).json({ bSuccess: false, strMessage: strMsgCred });
      return;
    }

    const strKindVal = strKind && ARR_DB_KIND.includes(strKind) ? strKind : 'GAME';
    const objSvcResolved = fnResolveServiceForConnectionWrite(Number(nProductId), nServiceId, strServiceAbbr);
    if ('strError' in objSvcResolved) {
      res.status(400).json({ bSuccess: false, strMessage: objSvcResolved.strError });
      return;
    }
    const strSvcNorm = fnNormalizeServiceAbbr(objSvcResolved.strServiceAbbr);
    const nSvcId = objSvcResolved.nServiceId;

    const objExisting = fnFindDuplicateDbConnection(
      nProductId,
      strEnv as IDbConnection['strEnv'],
      strKindVal,
      strHost as string,
      strDatabase as string,
      undefined,
      strSvcNorm,
    );
    if (objExisting) {
      const objProductDup = arrProducts.find((p) => p.nId === nProductId);
      const strProductName = objProductDup?.strName || `프로덕트 #${nProductId}`;
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage:
          `[${strProductName}] [${String(strEnv).toUpperCase()}] [${strKindVal}]` +
          (strSvcNorm ? ` [${strSvcNorm}]` : ' [전체(미지정)]') +
          ` 에 동일 호스트·DB명(${objExisting.strHost} / ${objExisting.strDatabase}) 접속이 이미 있습니다. ` +
          '다른 DB명이면 새로 등록할 수 있습니다.',
        objExistingDbConnection: fnResolveProductNameForConnection(objExisting),
      });
      return;
    }

    const strMismatchCreate = fnMismatchProductDbTypeMessage(nProductId, strDbType as string);
    if (strMismatchCreate) {
      res.status(400).json({ bSuccess: false, strMessage: strMismatchCreate });
      return;
    }

    const objProduct     = arrProducts.find((p) => p.nId === nProductId);
    const strProductName = objProduct?.strName || '';
    const nFinalPort     = nPort || (strDbType === 'mssql' ? 1433 : 3306);

    const objNew: IDbConnection = {
      nId:          fnGetNextDbConnectionId(),
      nProductId,
      strProductName,
      nServiceId:   nSvcId,
      strServiceAbbr: strSvcNorm || undefined,
      strKind:       strKindVal,
      strEnv:        strEnv as IDbConnection['strEnv'],
      strDbType:     strDbType as IDbConnection['strDbType'],
      strHost,
      nPort:         nFinalPort,
      strDatabase,
      strUser: (strUser as string).trim(),
      strPassword: strPassword as string,
      bIsActive:     true,
      dtCreatedAt:  new Date().toISOString(),
      dtUpdatedAt:  new Date().toISOString(),
    };

    arrDbConnections.push(objNew);
    try {
      await fnPersistDbConnectionRow(objNew);
    } catch (errPersist: unknown) {
      arrDbConnections.pop();
      console.error('[DB 접속] MySQL 반영 실패 |', errPersist);
      res.status(500).json({ bSuccess: false, strMessage: fnMysqlPersistErrorMessage(errPersist) });
      return;
    }
    res.json({
      bSuccess: true,
      strMessage: 'DB 접속 정보가 등록되었습니다.',
      objDbConnection: { ...objNew, strPassword: '••••••••' },
    });
  } catch (error) {
    console.error('DB 접속 정보 추가 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// DB 접속 정보 수정
export const fnUpdateDbConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const objConn = arrDbConnections.find((c) => c.nId === nId);

    if (!objConn) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    const { strHost, nPort, strDatabase, strUser, strPassword, strDbType, strKind, bIsActive, strServiceAbbr, nServiceId } = req.body;

    const strMsgCred = fnValidateDbConnectionCredentials(
      strUser !== undefined ? strUser : objConn.strUser,
      strPassword,
      false,
    );
    if (strUser !== undefined && strMsgCred?.includes('사용자')) {
      res.status(400).json({ bSuccess: false, strMessage: strMsgCred });
      return;
    }
    if (strPassword !== undefined && strPassword !== '••••••••' && strMsgCred?.includes('비밀번호')) {
      res.status(400).json({ bSuccess: false, strMessage: strMsgCred });
      return;
    }

    const strNextDbType = strDbType !== undefined ? strDbType : objConn.strDbType;
    const strMismatchUpdate = fnMismatchProductDbTypeMessage(objConn.nProductId, strNextDbType as string);
    if (strMismatchUpdate) {
      res.status(400).json({ bSuccess: false, strMessage: strMismatchUpdate });
      return;
    }

    const strNextHost = strHost !== undefined ? String(strHost).trim() : objConn.strHost;
    const strNextDatabase = strDatabase !== undefined ? String(strDatabase).trim() : objConn.strDatabase;
    const strNextKind =
      strKind !== undefined && ARR_DB_KIND.includes(strKind) ? strKind : objConn.strKind;
    const bServiceFieldsSent = strServiceAbbr !== undefined || nServiceId !== undefined;
    let strNextSvc: string | undefined = fnNormalizeServiceAbbr(objConn.strServiceAbbr) || undefined;
    let nNextSvcId = objConn.nServiceId;
    if (bServiceFieldsSent) {
      if (strServiceAbbr !== undefined && nServiceId === undefined) {
        res.status(400).json({ bSuccess: false, strMessage: STR_SERVICE_ID_WRITE_REQUIRED });
        return;
      }
      if (nServiceId !== undefined) {
        const nRaw = nServiceId == null || nServiceId === '' ? 0 : Number(nServiceId);
        if (nRaw <= 0) {
          strNextSvc = undefined;
          nNextSvcId = undefined;
        } else {
          const objSvcResolved = fnResolveServiceForConnectionWrite(objConn.nProductId, nRaw, null);
          if ('strError' in objSvcResolved) {
            res.status(400).json({ bSuccess: false, strMessage: objSvcResolved.strError });
            return;
          }
          strNextSvc = fnNormalizeServiceAbbr(objSvcResolved.strServiceAbbr);
          nNextSvcId = objSvcResolved.nServiceId;
        }
      }
    }
    const objDupUpdate = fnFindDuplicateDbConnection(
      objConn.nProductId,
      objConn.strEnv,
      strNextKind,
      strNextHost,
      strNextDatabase,
      nId,
      strNextSvc,
    );
    if (objDupUpdate) {
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage:
          `동일 호스트·DB명(${strNextHost} / ${strNextDatabase}) 접속이 이미 있습니다. ` +
          `(기존 #${objDupUpdate.nId})`,
        objExistingDbConnection: fnResolveProductNameForConnection(objDupUpdate),
      });
      return;
    }

    const objSnapshot: IDbConnection = { ...objConn };
    if (strHost     !== undefined) objConn.strHost     = strHost;
    if (nPort       !== undefined) objConn.nPort       = nPort;
    if (strDatabase !== undefined) objConn.strDatabase = strDatabase;
    if (strUser !== undefined) objConn.strUser = String(strUser).trim();
    if (strPassword !== undefined && strPassword !== '••••••••') objConn.strPassword = strPassword;
    if (strDbType   !== undefined) objConn.strDbType   = strDbType;
    if (strKind     !== undefined && ARR_DB_KIND.includes(strKind)) objConn.strKind = strKind;
    if (bServiceFieldsSent) {
      objConn.nServiceId = nNextSvcId;
      objConn.strServiceAbbr = strNextSvc || undefined;
    }
    if (bIsActive   !== undefined) objConn.bIsActive   = bIsActive;
    objConn.dtUpdatedAt = new Date().toISOString();
    try {
      await fnPersistDbConnectionRow(objConn);
    } catch (errPersist: unknown) {
      Object.assign(objConn, objSnapshot);
      console.error('[DB 접속] MySQL 반영 실패 |', errPersist);
      res.status(500).json({ bSuccess: false, strMessage: fnMysqlPersistErrorMessage(errPersist) });
      return;
    }

    const { fnInvalidatePool } = await import('../db/dbManager');
    await fnInvalidatePool(nId);

    res.json({
      bSuccess: true,
      strMessage: 'DB 접속 정보가 수정되었습니다.',
      objDbConnection: { ...objConn, strPassword: '••••••••' },
    });
  } catch (error) {
    console.error('DB 접속 정보 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// DB 접속 정보 삭제
export const fnDeleteDbConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const nIndex = arrDbConnections.findIndex((c) => c.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    const strMemBlock = fnGetDbConnectionDeleteBlockReasonFromMemory(nId);
    if (strMemBlock) {
      res.status(409).json({ bSuccess: false, strMessage: strMemBlock });
      return;
    }

    if (fnIsMysqlStore()) {
      const strMysqlBlock = await fnGetDbConnectionDeleteBlockReason(fnGetMysqlAppPool(), nId);
      if (strMysqlBlock) {
        res.status(409).json({ bSuccess: false, strMessage: strMysqlBlock });
        return;
      }
    }

    const objRemoved = arrDbConnections[nIndex];
    arrDbConnections.splice(nIndex, 1);
    try {
      await fnPersistDbConnectionDelete(nId);
    } catch (errPersist: unknown) {
      arrDbConnections.splice(nIndex, 0, objRemoved);
      const strMessage = fnMysqlPersistErrorMessage(errPersist);
      console.error('[DB 접속] MySQL 반영 실패 |', errPersist);
      res.status(fnIsDbConnectionPersistConflict(strMessage) ? 409 : 500).json({
        bSuccess: false,
        strMessage,
      });
      return;
    }

    const { fnInvalidatePool } = await import('../db/dbManager');
    await fnInvalidatePool(nId);

    res.json({ bSuccess: true, strMessage: 'DB 접속 정보가 삭제되었습니다.' });
  } catch (error) {
    console.error('DB 접속 정보 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 연결 테스트
export const fnTestConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objConn =
      (await fnRefreshDbConnectionByIdFromMysql(nId)) ?? arrDbConnections.find((c) => c.nId === nId);

    if (!objConn) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    const strPassProbe = objConn.strPassword ?? '';
    console.log(
      `[연결테스트] ${objConn.strDbType} | user="${(objConn.strUser ?? '').trim()}" | ` +
        `passLen=${strPassProbe.startsWith('enc:v1:') ? 'enc' : String(strPassProbe.length)} | ` +
        `${objConn.strHost}:${objConn.nPort}/${objConn.strDatabase}`,
    );

    const strMsgCred = fnValidateDbConnectionCredentials(objConn.strUser, objConn.strPassword, true);
    if (strMsgCred) {
      res.status(400).json({ bSuccess: false, strMessage: '연결 실패', strError: strMsgCred });
      return;
    }
    const objResult = await fnTestDbConnection(objConn);
    res.json(objResult);
  } catch (error) {
    console.error('연결 테스트 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
