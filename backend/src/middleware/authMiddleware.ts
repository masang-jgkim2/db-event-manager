import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJwtPayload } from '../types';
import { fnTouchUserPresence } from '../services/userPresence';
import { fnFindUserByStrUserId, fnFindUserRowById } from '../data/users';
import { fnBuildAuthUserPayload } from '../services/authUserResponse';
import { fnGetUserLoginBlock } from '../types/userStatus';

// Request 확장 - 인증된 사용자 정보 포함
declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}

const strJwtSecret = process.env.JWT_SECRET || 'default-secret';

// JWT 토큰 검증 미들웨어
// SSE 연결은 헤더 설정이 불가하므로 쿼리스트링 ?token= 도 허용
export const fnAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Authorization 헤더 우선, 없으면 쿼리스트링 폴백 (SSE용)
  const strAuthHeader = req.headers.authorization;
  let strToken: string | undefined;

  if (strAuthHeader?.startsWith('Bearer ')) {
    strToken = strAuthHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string') {
    strToken = req.query.token;
  }

  if (!strToken) {
    res.status(401).json({ bSuccess: false, strMessage: '인증 토큰이 필요합니다.' });
    return;
  }

  try {
    const decoded = jwt.verify(strToken, strJwtSecret) as IJwtPayload;
    const objFullUser = fnFindUserByStrUserId(decoded.strUserId);
    if (!objFullUser || objFullUser.nId !== decoded.nId) {
      res.status(401).json({ bSuccess: false, strMessage: '유효하지 않은 토큰입니다.' });
      return;
    }
    const row = fnFindUserRowById(objFullUser.nId);
    const objBlock = fnGetUserLoginBlock(row?.strStatus, objFullUser.arrRoles, row?.strEmail);
    if (objBlock) {
      res.status(403).json({ bSuccess: false, ...objBlock });
      return;
    }
    const objAuthUser = fnBuildAuthUserPayload(objFullUser);
    req.user = {
      ...decoded,
      strDisplayName: objAuthUser.strDisplayName,
      arrRoles: objAuthUser.arrRoles,
      arrPermissions: objAuthUser.arrPermissions as IJwtPayload['arrPermissions'],
    };
    // 로그아웃은 직후 fnMarkUserOffline으로 끊음 — 여기서 터치하면 window 내 녹색 잔류
    const bIsLogout = req.method === 'POST' && req.path === '/logout';
    if (!bIsLogout) {
      fnTouchUserPresence(decoded.nId);
    }
    next();
  } catch {
    res.status(401).json({ bSuccess: false, strMessage: '유효하지 않은 토큰입니다.' });
  }
};
