import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ILoginRequest, IJwtPayload } from '../types';
import { arrUsers } from '../data/users';

const strJwtSecret = process.env.JWT_SECRET || 'default-secret';
const strJwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

// 로그인 처리
export const fnLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strUserId, strPassword } = req.body as ILoginRequest;

    // 입력값 검증
    if (!strUserId || !strPassword) {
      res.status(400).json({
        bSuccess: false,
        strMessage: '아이디와 비밀번호를 입력해주세요.',
      });
      return;
    }

    // 사용자 조회
    const objUser = arrUsers.find((u) => u.strUserId === strUserId);
    if (!objUser) {
      res.status(401).json({
        bSuccess: false,
        strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
      return;
    }

    // 비밀번호 검증
    const bIsPasswordValid = await bcrypt.compare(strPassword, objUser.strPassword);
    if (!bIsPasswordValid) {
      res.status(401).json({
        bSuccess: false,
        strMessage: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
      return;
    }

    // JWT 토큰 생성
    const objPayload: IJwtPayload = {
      nId: objUser.nId,
      strUserId: objUser.strUserId,
      strRole: objUser.strRole,
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
        strRole: objUser.strRole,
      },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      bSuccess: false,
      strMessage: '서버 오류가 발생했습니다.',
    });
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

    // 사용자 정보 조회
    const objFullUser = arrUsers.find((u) => u.nId === objUser.nId);
    if (!objFullUser) {
      res.status(401).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    res.json({
      bSuccess: true,
      user: {
        nId: objFullUser.nId,
        strUserId: objFullUser.strUserId,
        strDisplayName: objFullUser.strDisplayName,
        strRole: objFullUser.strRole,
      },
    });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
