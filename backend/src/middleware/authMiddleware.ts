import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJwtPayload } from '../types';

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
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ bSuccess: false, strMessage: '유효하지 않은 토큰입니다.' });
  }
};
