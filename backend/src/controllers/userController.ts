import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  arrUsers,
  fnFindUserRowById,
  fnGetNextId,
  fnGetUsersWithRoles,
  fnSaveUserAndRoles,
  fnSaveUsers,
} from '../data/users';
import { fnGetMergedPermissions, fnGetRoleIdsByRoleCodes } from '../data/roles';
import { fnRemoveUserRolesAndSave } from '../data/userRoles';

// 사용자 목록 조회 (정규화: user_roles에서 역할 조립)
export const fnGetUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const arrWithRoles = fnGetUsersWithRoles();
    const arrSafeUsers = arrWithRoles.map((u) => ({
      nId:            u.nId,
      strUserId:      u.strUserId,
      strDisplayName: u.strDisplayName,
      arrRoles:       u.arrRoles,
      arrPermissions: fnGetMergedPermissions(u.arrRoles),
      dtCreatedAt:    u.dtCreatedAt,
    }));
    res.json({ bSuccess: true, arrUsers: arrSafeUsers });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 추가 — 행 저장 + user_roles 저장
export const fnCreateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strUserId, strPassword, strDisplayName, arrRoles: arrRoleCodes } = req.body;

    if (!strUserId || !strPassword || !strDisplayName || !Array.isArray(arrRoleCodes) || arrRoleCodes.length === 0) {
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

    const nId = fnGetNextId();
    const strHashedPassword = await bcrypt.hash(strPassword, 10);
    arrUsers.push({
      nId,
      strUserId,
      strPassword: strHashedPassword,
      strDisplayName,
      dtCreatedAt: new Date().toISOString(),
    });
    const arrRoleIds = fnGetRoleIdsByRoleCodes(arrRoleCodes);
    fnSaveUserAndRoles(nId, arrRoleIds);

    const arrPermissions = fnGetMergedPermissions(arrRoleCodes);
    res.json({
      bSuccess: true,
      strMessage: '사용자가 생성되었습니다.',
      user: {
        nId,
        strUserId,
        strDisplayName,
        arrRoles: arrRoleCodes,
        arrPermissions,
      },
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 수정 — 행 수정 + user_roles 갱신
export const fnUpdateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objUser = fnFindUserRowById(nId);

    if (!objUser) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const { strDisplayName, arrRoles: arrRoleCodes } = req.body;
    if (strDisplayName !== undefined) objUser.strDisplayName = strDisplayName;
    if (Array.isArray(arrRoleCodes) && arrRoleCodes.length > 0) {
      const arrRoleIds = fnGetRoleIdsByRoleCodes(arrRoleCodes);
      fnSaveUserAndRoles(nId, arrRoleIds);
    } else {
      fnSaveUsers();
    }

    const arrWithRoles = fnGetUsersWithRoles();
    const objFull = arrWithRoles.find((u) => u.nId === nId);
    const arrRoles = objFull?.arrRoles ?? [];
    res.json({
      bSuccess: true,
      strMessage: '사용자가 수정되었습니다.',
      user: {
        nId:            objUser.nId,
        strUserId:      objUser.strUserId,
        strDisplayName: objUser.strDisplayName,
        arrRoles,
        arrPermissions: fnGetMergedPermissions(arrRoles),
      },
    });
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 삭제 — 행 삭제 (user_roles는 해당 user 삭제 시 CASCADE로 제거하므로 수동 삭제)
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

    fnRemoveUserRolesAndSave(nId);
    arrUsers.splice(nIndex, 1);
    fnSaveUsers();
    res.json({ bSuccess: true, strMessage: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 초기화
export const fnResetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const { strNewPassword } = req.body;

    if (!strNewPassword) {
      res.status(400).json({ bSuccess: false, strMessage: '새 비밀번호를 입력해주세요.' });
      return;
    }

    const objUser = fnFindUserRowById(nId);
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
