import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { arrUsers, fnGetNextId } from '../data/users';

// 사용자 목록 조회 (관리자 전용)
export const fnGetUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    // 비밀번호 제외하고 반환
    const arrSafeUsers = arrUsers.map((u) => ({
      nId: u.nId,
      strUserId: u.strUserId,
      strDisplayName: u.strDisplayName,
      strRole: u.strRole,
      dtCreatedAt: u.dtCreatedAt,
    }));

    res.json({ bSuccess: true, arrUsers: arrSafeUsers });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 추가 (관리자 전용)
export const fnCreateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strUserId, strPassword, strDisplayName, strRole } = req.body;

    // 입력값 검증
    if (!strUserId || !strPassword || !strDisplayName || !strRole) {
      res.status(400).json({ bSuccess: false, strMessage: '모든 필드를 입력해주세요.' });
      return;
    }

    // 중복 아이디 확인
    const objExisting = arrUsers.find((u) => u.strUserId === strUserId);
    if (objExisting) {
      res.status(400).json({ bSuccess: false, strMessage: '이미 존재하는 아이디입니다.' });
      return;
    }

    // 비밀번호 해싱 후 저장
    const strHashedPassword = await bcrypt.hash(strPassword, 10);
    const objNewUser = {
      nId: fnGetNextId(),
      strUserId,
      strPassword: strHashedPassword,
      strDisplayName,
      strRole: strRole as 'admin' | 'gm' | 'planner',
      dtCreatedAt: new Date(),
    };

    arrUsers.push(objNewUser);

    res.json({
      bSuccess: true,
      strMessage: '사용자가 생성되었습니다.',
      user: {
        nId: objNewUser.nId,
        strUserId: objNewUser.strUserId,
        strDisplayName: objNewUser.strDisplayName,
        strRole: objNewUser.strRole,
      },
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 삭제 (관리자 전용)
export const fnDeleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);

    // 본인 삭제 방지
    if (req.user?.nId === nId) {
      res.status(400).json({ bSuccess: false, strMessage: '본인 계정은 삭제할 수 없습니다.' });
      return;
    }

    const nIndex = arrUsers.findIndex((u) => u.nId === nId);
    if (nIndex === -1) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    arrUsers.splice(nIndex, 1);
    res.json({ bSuccess: true, strMessage: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 초기화 (관리자 전용)
export const fnResetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const { strNewPassword } = req.body;

    if (!strNewPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '새 비밀번호를 입력해주세요.' });
      return;
    }

    const objUser = arrUsers.find((u) => u.nId === nId);
    if (!objUser) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    objUser.strPassword = await bcrypt.hash(strNewPassword, 10);
    res.json({ bSuccess: true, strMessage: '비밀번호가 초기화되었습니다.' });
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
