import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ILoginRequest, IJwtPayload } from '../types';
import { arrUsers } from '../data/users';
import { fnGetMergedPermissions } from '../data/roles';

const strJwtSecret = process.env.JWT_SECRET || 'default-secret';
const strJwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

// 로그인 처리
export const fnLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strUserId, strPassword } = req.body as ILoginRequest;

    if (!strUserId || !strPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '아이디와 비밀번호를 입력해주세요.' });
      return;
    }

    const objUser = arrUsers.find((u) => u.strUserId === strUserId);
    if (!objUser) {
      res.status(401).json({ bSuccess: false, strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const bIsPasswordValid = await bcrypt.compare(strPassword, objUser.strPassword);
    if (!bIsPasswordValid) {
      res.status(401).json({ bSuccess: false, strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    // 사용자의 모든 역할에서 권한 합집합 계산
    const arrPermissions = fnGetMergedPermissions(objUser.arrRoles);

    // JWT 페이로드에 역할 + 권한 목록 포함
    const objPayload: IJwtPayload = {
      nId: objUser.nId,
      strUserId: objUser.strUserId,
      arrRoles: objUser.arrRoles,
      arrPermissions: arrPermissions as any,
    };

    const strToken = jwt.sign(objPayload, strJwtSecret, {
      expiresIn: strJwtExpiresIn as any,
    });

    res.json({
      bSuccess: true,
      strToken,
      user: {
        nId: objUser.nId,
        strUserId: objUser.strUserId,
        strDisplayName: objUser.strDisplayName,
        arrRoles: objUser.arrRoles,
        arrPermissions: arrPermissions as any,
      },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 토큰 검증 (프론트에서 자동 로그인 확인용)
export const fnVerifyToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const objUser = req.user;
    if (!objUser) {
      res.status(401).json({ bSuccess: false, strMessage: '인증되지 않은 사용자입니다.' });
      return;
    }

    // 최신 권한 정보를 DB에서 재조회 (권한이 변경됐을 경우 반영)
    const objFullUser = arrUsers.find((u) => u.nId === objUser.nId);
    if (!objFullUser) {
      res.status(401).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    // 최신 권한 재계산
    const arrPermissions = fnGetMergedPermissions(objFullUser.arrRoles);

    res.json({
      bSuccess: true,
      user: {
        nId: objFullUser.nId,
        strUserId: objFullUser.strUserId,
        strDisplayName: objFullUser.strDisplayName,
        arrRoles: objFullUser.arrRoles,
        arrPermissions: arrPermissions as any,
      },
    });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
