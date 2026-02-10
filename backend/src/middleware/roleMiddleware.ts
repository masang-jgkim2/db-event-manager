import { Request, Response, NextFunction } from 'express';

// 관리자 전용 미들웨어
export const fnAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.strRole !== 'admin') {
    res.status(403).json({ bSuccess: false, strMessage: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
};
