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
export const fnAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const strAuthHeader = req.headers.authorization;

  if (!strAuthHeader || !strAuthHeader.startsWith('Bearer ')) {
    res.status(401).json({ bSuccess: false, strMessage: '인증 토큰이 필요합니다.' });
    return;
  }

  const strToken = strAuthHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(strToken, strJwtSecret) as IJwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ bSuccess: false, strMessage: '유효하지 않은 토큰입니다.' });
    return;
  }
};
