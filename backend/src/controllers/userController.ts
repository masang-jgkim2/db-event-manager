import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { arrUsers, fnGetNextId, fnSaveUsers } from '../data/users';
import { fnGetMergedPermissions } from '../data/roles';

// 사용자 목록 조회 (관리자 전용)
export const fnGetUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const arrSafeUsers = arrUsers.map((u) => {
      const arrPermissions = fnGetMergedPermissions(u.arrRoles);
      return {
        nId:            u.nId,
        strUserId:      u.strUserId,
        strDisplayName: u.strDisplayName,
        arrRoles:       u.arrRoles,
        arrPermissions,
        dtCreatedAt:    u.dtCreatedAt,
      };
    });
    res.json({ bSuccess: true, arrUsers: arrSafeUsers });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 추가 (관리자 전용)
export const fnCreateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strUserId, strPassword, strDisplayName, arrRoles } = req.body;

    if (!strUserId || !strPassword || !strDisplayName || !Array.isArray(arrRoles) || arrRoles.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '모든 필드를 입력해주세요. 역할은 최소 1개 이상 필요합니다.' });
      return;
    }

    const objExisting = arrUsers.find((u) => u.strUserId === strUserId);
    if (objExisting) {
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage: `[${strUserId}] 아이디가 이미 존재합니다.`,
      });
      return;
    }

    const strHashedPassword = await bcrypt.hash(strPassword, 10);
    const objNewUser = {
      nId:            fnGetNextId(),
      strUserId,
      strPassword:    strHashedPassword,
      strDisplayName,
      arrRoles,
      dtCreatedAt:    new Date(),
    };
    arrUsers.push(objNewUser);
    fnSaveUsers();
    const arrPermissions = fnGetMergedPermissions(objNewUser.arrRoles);

    res.json({
      bSuccess: true,
      strMessage: '사용자가 생성되었습니다.',
      user: {
        nId:            objNewUser.nId,
        strUserId:      objNewUser.strUserId,
        strDisplayName: objNewUser.strDisplayName,
        arrRoles:       objNewUser.arrRoles,
        arrPermissions,
      },
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 수정 (이름 + 역할 수정 가능, 아이디 불가)
export const fnUpdateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId    = Number(req.params.id);
    const objUser = arrUsers.find((u) => u.nId === nId);

    if (!objUser) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const { strDisplayName, arrRoles } = req.body;
    if (strDisplayName !== undefined) objUser.strDisplayName = strDisplayName;
    if (Array.isArray(arrRoles) && arrRoles.length > 0) objUser.arrRoles = arrRoles;

    fnSaveUsers();
    const arrPermissions = fnGetMergedPermissions(objUser.arrRoles);
    res.json({
      bSuccess: true,
      strMessage: '사용자가 수정되었습니다.',
      user: {
        nId:            objUser.nId,
        strUserId:      objUser.strUserId,
        strDisplayName: objUser.strDisplayName,
        arrRoles:       objUser.arrRoles,
        arrPermissions,
      },
    });
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 삭제 (관리자 전용)
export const fnDeleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);

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
    fnSaveUsers();
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
    fnSaveUsers();
    res.json({ bSuccess: true, strMessage: '비밀번호가 초기화되었습니다.' });
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
