import { Request, Response, NextFunction } from 'express';
import { fnPushActivityLog } from '../data/activityLogs';

/** 활동 로그에서 제외 (노이즈·별도 기록) */
const fnShouldSkipActivityLog = (req: Request): boolean => {
  const strPath = (req.originalUrl || req.url || '').split('?')[0];
  if (strPath === '/api/health') return true;
  // 로그인은 authController에서 시도자·성공 사용자 반영
  if (req.method === 'POST' && strPath === '/api/auth/login') return true;
  // 새로고침마다 대량 적재 방지
  if (req.method === 'GET' && strPath === '/api/auth/verify') return true;
  if (strPath === '/api/auth/ui-preferences') return true;
  // 활동 화면 조회·SSE는 기록 시 GET logs → SSE → 무한 재조회 루프가 되므로 제외
  if (req.method === 'GET' && strPath === '/api/activity/logs') return true;
  if (req.method === 'GET' && strPath === '/api/activity/stream') return true;
  if (req.method === 'GET' && strPath === '/api/activity/actors') return true;
  if (req.method === 'GET' && strPath === '/api/users/presence-stream') return true;
  return false;
};

/**
 * HTTP 요청 완료 시 메서드·경로·상태코드·행위자(인증된 경우) 기록
 */
export const fnActivityLogMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (fnShouldSkipActivityLog(req)) {
    next();
    return;
  }

  res.on('finish', () => {
    try {
      const strPathRaw = req.originalUrl || req.url || '';
      const strPath = strPathRaw.split('?')[0] || strPathRaw;
      const objUser = req.user;
      const arrRoles =
        objUser?.arrRoles != null && objUser.arrRoles.length > 0 ? [...objUser.arrRoles] : null;
      fnPushActivityLog({
        strMethod: req.method.toUpperCase(),
        strPath,
        nStatusCode: res.statusCode,
        nActorUserId: objUser?.nId ?? null,
        strActorUserId: objUser?.strUserId ?? null,
        arrActorRoles: arrRoles,
      });
    } catch (err: unknown) {
      console.error('[활동 로그] finish 기록 실패:', err);
    }
  });

  next();
};
