import { Request, Response } from 'express';
import { arrDbConnections, fnGetNextDbConnectionId, fnSaveDbConnections, fnReloadDbConnectionsFromDiskIfEmpty } from '../data/dbConnections';
import { arrProducts } from '../data/products';
import { IDbConnection } from '../types';
import { fnTestDbConnection } from '../db/dbManager';

// DB 접속 정보 목록 조회
export const fnGetDbConnections = async (_req: Request, res: Response): Promise<void> => {
  try {
    fnReloadDbConnectionsFromDiskIfEmpty();
    const arrSafe = arrDbConnections.map((c) => ({ ...c, strPassword: '••••••••' }));
    res.json({ bSuccess: true, arrDbConnections: arrSafe });
  } catch (error) {
    console.error('DB 접속 정보 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

const ARR_DB_KIND: IDbConnection['strKind'][] = ['GAME', 'WEB', 'LOG'];

// 프로덕트에 정의된 DB 종류(mssql/mysql)와 접속 정보 일치 검사 (없는 프로덕트면 스킵)
const fnMismatchProductDbTypeMessage = (nProductId: number, strConnDbType: string): string | null => {
  const objProduct = arrProducts.find((p) => p.nId === nProductId);
  if (!objProduct) return null;
  if (objProduct.strDbType !== strConnDbType) {
    return `프로덕트「${objProduct.strName}」의 DB 종류는 ${objProduct.strDbType}입니다. 접속 DB 종류를 동일하게 맞춰주세요.`;
  }
  return null;
};

// DB 접속 정보 추가
export const fnCreateDbConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nProductId, strKind, strEnv, strDbType,
      strHost, nPort, strDatabase, strUser, strPassword,
    } = req.body as Partial<IDbConnection>;

    if (!nProductId || !strEnv || !strDbType || !strHost || !strDatabase || !strUser || !strPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 모두 입력해주세요.' });
      return;
    }

    const strKindVal = strKind && ARR_DB_KIND.includes(strKind) ? strKind : 'GAME';

    // 동일 프로덕트 + 환경 + 종류 중복 확인
    const objExisting = arrDbConnections.find(
      (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.strKind === strKindVal
    );
    if (objExisting) {
      const objProductDup     = arrProducts.find((p) => p.nId === nProductId);
      const strProductName = objProductDup?.strName || `프로덕트 #${nProductId}`;
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage: `[${strProductName}] 프로덕트의 [${strEnv.toUpperCase()}] 환경 [${strKindVal}] 접속 정보가 이미 등록되어 있습니다. 기존 항목을 수정해주세요.`,
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
      strKind:       strKindVal,
      strEnv:        strEnv as IDbConnection['strEnv'],
      strDbType:     strDbType as IDbConnection['strDbType'],
      strHost,
      nPort:         nFinalPort,
      strDatabase,
      strUser,
      strPassword,
      bIsActive:     true,
      dtCreatedAt:  new Date().toISOString(),
      dtUpdatedAt:  new Date().toISOString(),
    };

    arrDbConnections.push(objNew);
    fnSaveDbConnections();
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

    const { strHost, nPort, strDatabase, strUser, strPassword, strDbType, strKind, bIsActive } = req.body;

    const strNextDbType = strDbType !== undefined ? strDbType : objConn.strDbType;
    const strMismatchUpdate = fnMismatchProductDbTypeMessage(objConn.nProductId, strNextDbType as string);
    if (strMismatchUpdate) {
      res.status(400).json({ bSuccess: false, strMessage: strMismatchUpdate });
      return;
    }

    if (strHost     !== undefined) objConn.strHost     = strHost;
    if (nPort       !== undefined) objConn.nPort       = nPort;
    if (strDatabase !== undefined) objConn.strDatabase = strDatabase;
    if (strUser     !== undefined) objConn.strUser     = strUser;
    if (strPassword !== undefined && strPassword !== '••••••••') objConn.strPassword = strPassword;
    if (strDbType   !== undefined) objConn.strDbType   = strDbType;
    if (strKind     !== undefined && ARR_DB_KIND.includes(strKind)) objConn.strKind = strKind;
    if (bIsActive   !== undefined) objConn.bIsActive   = bIsActive;
    objConn.dtUpdatedAt = new Date().toISOString();
    fnSaveDbConnections();

    const { fnInvalidatePool } = await import('../db/dbManager');
    fnInvalidatePool(nId);

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

    arrDbConnections.splice(nIndex, 1);
    fnSaveDbConnections();

    const { fnInvalidatePool } = await import('../db/dbManager');
    fnInvalidatePool(nId);

    res.json({ bSuccess: true, strMessage: 'DB 접속 정보가 삭제되었습니다.' });
  } catch (error) {
    console.error('DB 접속 정보 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 연결 테스트
export const fnTestConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const objConn = arrDbConnections.find((c) => c.nId === nId);

    if (!objConn) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    const objResult = await fnTestDbConnection(objConn);
    res.json(objResult);
  } catch (error) {
    console.error('연결 테스트 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
