import { Request, Response } from 'express';
import { arrDbConnections, fnGetNextDbConnectionId } from '../data/dbConnections';
import { arrProducts } from '../data/products';
import { IDbConnection } from '../types';
import { fnTestDbConnection } from '../db/dbManager';

// DB 접속 정보 목록 조회
export const fnGetDbConnections = async (_req: Request, res: Response): Promise<void> => {
  try {
    // 비밀번호 마스킹 처리
    const arrSafe = arrDbConnections.map((c) => ({
      ...c,
      strPassword: '••••••••',
    }));
    res.json({ bSuccess: true, arrDbConnections: arrSafe });
  } catch (error) {
    console.error('DB 접속 정보 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// DB 접속 정보 추가
export const fnCreateDbConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nProductId, strEnv, strDbType,
      strHost, nPort, strDatabase, strUser, strPassword,
    } = req.body as Partial<IDbConnection>;

    if (!nProductId || !strEnv || !strDbType || !strHost || !strDatabase || !strUser || !strPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '필수 항목을 모두 입력해주세요.' });
      return;
    }

    // 동일 프로덕트 + 환경 중복 확인
    const objExisting = arrDbConnections.find(
      (c) => c.nProductId === nProductId && c.strEnv === strEnv
    );
    if (objExisting) {
      res.status(400).json({
        bSuccess: false,
        strMessage: '해당 프로덕트의 같은 환경 접속 정보가 이미 존재합니다. 수정을 이용해주세요.',
      });
      return;
    }

    // 프로덕트명 자동 매핑
    const objProduct = arrProducts.find((p) => p.nId === nProductId);
    const strProductName = objProduct?.strName || '';

    // 기본 포트 자동 설정
    const nFinalPort = nPort || (strDbType === 'mssql' ? 1433 : 3306);

    const objNew: IDbConnection = {
      nId: fnGetNextDbConnectionId(),
      nProductId,
      strProductName,
      strEnv: strEnv as 'qa' | 'live',
      strDbType: strDbType as 'mssql' | 'mysql',
      strHost,
      nPort: nFinalPort,
      strDatabase,
      strUser,
      strPassword,
      bIsActive: true,
      dtCreatedAt: new Date().toISOString(),
      dtUpdatedAt: new Date().toISOString(),
    };

    arrDbConnections.push(objNew);

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
    const nId = Number(req.params.id);
    const objConn = arrDbConnections.find((c) => c.nId === nId);

    if (!objConn) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    const {
      strHost, nPort, strDatabase, strUser, strPassword,
      strDbType, bIsActive,
    } = req.body;

    if (strHost !== undefined) objConn.strHost = strHost;
    if (nPort !== undefined) objConn.nPort = nPort;
    if (strDatabase !== undefined) objConn.strDatabase = strDatabase;
    if (strUser !== undefined) objConn.strUser = strUser;
    if (strPassword !== undefined && strPassword !== '••••••••') {
      objConn.strPassword = strPassword;  // 마스킹값이 아닐 때만 업데이트
    }
    if (strDbType !== undefined) objConn.strDbType = strDbType;
    if (bIsActive !== undefined) objConn.bIsActive = bIsActive;
    objConn.dtUpdatedAt = new Date().toISOString();

    // 접속 정보가 변경됐으므로 커넥션 풀 캐시 무효화
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
    const nId = Number(req.params.id);
    const nIndex = arrDbConnections.findIndex((c) => c.nId === nId);

    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: 'DB 접속 정보를 찾을 수 없습니다.' });
      return;
    }

    arrDbConnections.splice(nIndex, 1);

    // 커넥션 풀 캐시 무효화
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
    const nId = Number(req.params.id);
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
