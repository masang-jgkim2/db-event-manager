import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ILoginRequest, IJwtPayload } from '../types';
import { fnFindUserByStrUserId } from '../data/users';
import { fnExpandPermissions, fnGetMergedPermissions } from '../data/roles';

const strJwtSecret    = process.env.JWT_SECRET    || 'default-secret';
const strJwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

// 로그인 (정규화: 사용자+역할 조립 후 검증)
export const fnLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const strUserIdTrim = typeof req.body?.strUserId === 'string' ? req.body.strUserId.trim() : '';
    const strPassword = req.body?.strPassword;
    if (!strUserIdTrim || !strPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '아이디와 비밀번호를 입력해주세요.' });
      return;
    }
    const objUser = fnFindUserByStrUserId(strUserIdTrim);
    if (!objUser) {
      console.log(`[로그인] 사용자 없음 | strUserId=${JSON.stringify(strUserIdTrim)}`);
      res.status(401).json({ bSuccess: false, strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const bIsPasswordValid = await bcrypt.compare(strPassword, objUser.strPassword);
    if (!bIsPasswordValid) {
      console.log(`[로그인] 비밀번호 불일치 | strUserId=${objUser.strUserId}`);
      res.status(401).json({ bSuccess: false, strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const arrRaw = fnGetMergedPermissions(objUser.arrRoles);
    const arrPermissions = fnExpandPermissions(arrRaw, objUser.arrRoles);

    const objPayload: IJwtPayload = {
      nId:            objUser.nId,
      strUserId:      objUser.strUserId,
      strDisplayName: objUser.strDisplayName,
      arrRoles:       objUser.arrRoles,
      arrPermissions: arrPermissions as any,
    };

    const strToken = jwt.sign(objPayload, strJwtSecret, { expiresIn: strJwtExpiresIn as any });

    res.json({
      bSuccess: true,
      strToken,
      user: {
        nId:            objUser.nId,
        strUserId:      objUser.strUserId,
        strDisplayName: objUser.strDisplayName,
        arrRoles:       objUser.arrRoles,
        arrPermissions: arrPermissions as any,
      },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 토큰 검증 (프론트 자동 로그인 확인용)
export const fnVerifyToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const objUser = req.user;
    if (!objUser) {
      res.status(401).json({ bSuccess: false, strMessage: '인증되지 않은 사용자입니다.' });
      return;
    }

    const objFullUser = fnFindUserByStrUserId(req.user!.strUserId);
    if (!objFullUser || objFullUser.nId !== objUser.nId) {
      res.status(401).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const arrRaw = fnGetMergedPermissions(objFullUser.arrRoles);
    const arrPermissions = fnExpandPermissions(arrRaw, objFullUser.arrRoles);

    res.json({
      bSuccess: true,
      user: {
        nId:            objFullUser.nId,
        strUserId:      objFullUser.strUserId,
        strDisplayName: objFullUser.strDisplayName,
        arrRoles:       objFullUser.arrRoles,
        arrPermissions: arrPermissions as any,
      },
    });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
