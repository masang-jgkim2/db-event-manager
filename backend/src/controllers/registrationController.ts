import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  arrUsers,
  fnCommitUserDataStore,
  fnFindUserByStrUserId,
  fnGetNextId,
  fnSaveUserAndRoles,
} from '../data/users';
import { fnGetRoleIdsByRoleCodes } from '../data/roles';
import {
  fnBuildMasangsoftEmail,
  fnIsMasangsoftEmail,
  fnIsValidEmailLocalPart,
  fnNormalizeUserId,
  REG_USER_ID,
  STR_EMAIL_DOMAIN,
  STR_ROLE_GUEST,
  STR_USER_STATUS_PENDING_APPROVAL,
} from '../types/userStatus';

const fnIsUserIdTaken = (strUserId: string): boolean => {
  const strNorm = strUserId.trim().toLowerCase();
  return Boolean(fnFindUserByStrUserId(strNorm) || fnFindUserByStrUserId(strUserId.trim()));
};

const fnIsEmailTaken = (strEmail: string): boolean => {
  const strNorm = strEmail.trim().toLowerCase();
  return arrUsers.some((u) => (u.strEmail ?? '').toLowerCase() === strNorm);
};

// GET /api/auth/check-register?strUserId=&strEmailLocal= — 가입 전 아이디·이메일 사용 가능 여부
export const fnCheckRegisterAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const strUserId = typeof req.query.strUserId === 'string' ? req.query.strUserId.trim() : '';
    const strEmailLocal = typeof req.query.strEmailLocal === 'string' ? req.query.strEmailLocal.trim() : '';

    let bUserIdAvailable: boolean | null = null;
    let bEmailAvailable: boolean | null = null;
    const arrHints: string[] = [];

    if (strUserId) {
      const strUserIdNorm = fnNormalizeUserId(strUserId);
      if (!REG_USER_ID.test(strUserIdNorm)) {
        bUserIdAvailable = false;
        arrHints.push('아이디 형식이 올바르지 않습니다.');
      } else {
        bUserIdAvailable = !fnIsUserIdTaken(strUserId);
      }
    }

    if (strEmailLocal) {
      if (!fnIsValidEmailLocalPart(strEmailLocal)) {
        bEmailAvailable = false;
        arrHints.push(`이메일 앞부분은 영문·숫자·._- 만 사용할 수 있습니다.`);
      } else {
        bEmailAvailable = !fnIsEmailTaken(fnBuildMasangsoftEmail(strEmailLocal));
      }
    }

    res.json({
      bSuccess: true,
      bUserIdAvailable,
      bEmailAvailable,
      strEmail: strEmailLocal ? fnBuildMasangsoftEmail(strEmailLocal) : undefined,
      strMessage: arrHints.length > 0 ? arrHints.join(' ') : undefined,
    });
  } catch (err: unknown) {
    console.error('[가입 확인] 오류 |', err);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

const objRegisterSchema = z.object({
  strUserId: z.string().trim().min(4).max(32).regex(/^[a-z0-9]+$/i, '아이디는 영문·숫자만 가능합니다.'),
  strEmail: z.string().trim().email(),
  strDisplayName: z.string().trim().min(1).max(200),
  strPassword: z.string().min(8).max(128),
});

// POST /api/auth/register — 공개 가입 (Phase A: 이메일 인증 링크는 미구현, pending_approval)
export const fnRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const objParsed = objRegisterSchema.safeParse(req.body);
    if (!objParsed.success) {
      res.status(400).json({ bSuccess: false, strMessage: '입력값이 올바르지 않습니다.' });
      return;
    }
    const { strUserId, strEmail, strDisplayName, strPassword } = objParsed.data;
    const strUserIdNorm = fnNormalizeUserId(strUserId);

    if (!fnIsMasangsoftEmail(strEmail)) {
      res.status(400).json({
        bSuccess: false,
        strMessage: `사내 이메일(${STR_EMAIL_DOMAIN})만 가입할 수 있습니다.`,
      });
      return;
    }

    if (fnIsUserIdTaken(strUserId)) {
      res.status(409).json({ bSuccess: false, strMessage: '이미 사용 중인 아이디입니다.' });
      return;
    }

    if (fnIsEmailTaken(strEmail)) {
      res.status(409).json({ bSuccess: false, strMessage: '이미 등록된 이메일입니다.' });
      return;
    }

    const nId = fnGetNextId();
    const strHash = await bcrypt.hash(strPassword, 10);
    arrUsers.push({
      nId,
      strUserId: strUserIdNorm,
      strPassword: strHash,
      strDisplayName,
      strEmail: strEmail.trim().toLowerCase(),
      strStatus: STR_USER_STATUS_PENDING_APPROVAL,
      dtCreatedAt: new Date().toISOString(),
    });
    const arrRoleIds = fnGetRoleIdsByRoleCodes([STR_ROLE_GUEST]);
    if (arrRoleIds.length === 0) {
      console.error('[가입] guest 역할 없음 — 서버 온보딩 설정 필요');
      arrUsers.pop();
      res.status(503).json({
        bSuccess: false,
        strMessage: '가입 처리를 완료할 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }
    fnSaveUserAndRoles(nId, arrRoleIds);
    await fnCommitUserDataStore();
    const rowAfter = arrUsers.find((u) => u.nId === nId);
    if (rowAfter?.strStatus !== STR_USER_STATUS_PENDING_APPROVAL) {
      console.error(`[가입] str_status 불일치 | ${strUserIdNorm} | ${rowAfter?.strStatus}`);
    }

    console.log(`[가입] pending_approval | ${strUserIdNorm} | ${strEmail}`);
    res.status(201).json({
      bSuccess: true,
      strMessage: '가입 신청이 접수되었습니다. 인증 메일 발송(예정) 후 관리자 승인을 기다려 주세요.',
      strMaskedEmail: strEmail.replace(/(^.).*(@.*$)/, '$1***$2'),
    });
  } catch (err: unknown) {
    console.error('[가입] 오류 |', err);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
