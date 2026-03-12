import { Request, Response, NextFunction } from 'express';
import { TPermission } from '../types';

// 관리자 전용 미들웨어 (기존 호환)
export const fnAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  const arrRoles = req.user?.arrRoles || [];
  if (!arrRoles.includes('admin')) {
    res.status(403).json({ bSuccess: false, strMessage: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
};

// 특정 권한 보유 여부 확인 미들웨어 팩토리
// 사용법: router.post('/execute', fnRequirePermission('instance.execute_qa'), fnHandler)
export const fnRequirePermission = (strPermission: TPermission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const arrPermissions = req.user?.arrPermissions || [];

    if (!arrPermissions.includes(strPermission)) {
      res.status(403).json({
        bSuccess: false,
        strMessage: `이 작업을 하려면 '${strPermission}' 권한이 필요합니다.`,
      });
      return;
    }
    next();
  };
};

// 여러 권한 중 하나라도 있으면 통과 (OR 조건)
export const fnRequireAnyPermission = (...arrRequiredPermissions: TPermission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const arrUserPermissions = req.user?.arrPermissions || [];
    const bHasPermission = arrRequiredPermissions.some((p) =>
      arrUserPermissions.includes(p)
    );

    if (!bHasPermission) {
      res.status(403).json({
        bSuccess: false,
        strMessage: `이 작업을 하려면 다음 권한 중 하나가 필요합니다: ${arrRequiredPermissions.join(', ')}`,
      });
      return;
    }
    next();
  };
};
