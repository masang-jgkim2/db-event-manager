import { Request, Response } from 'express';
import {
  arrRoles,
  fnFindRoleByCode,
  fnFindRoleRowById,
  fnGetNextRoleId,
  fnGetRolesWithPermissions,
  fnRemoveRolePermissionsAndSave,
  fnSaveRoleAndPermissions,
  fnSaveRoles,
} from '../data/roles';
import { fnGetPermissionsByRoleId } from '../data/rolePermissions';
import { arrUserRoles } from '../data/userRoles';
import { IRole, TPermission } from '../types';

// 역할 목록 조회 (정규화: 권한은 role_permissions에서 조립)
export const fnGetRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const arrRolesWithPerms = fnGetRolesWithPermissions();
    res.json({ bSuccess: true, arrRoles: arrRolesWithPerms });
  } catch (error) {
    console.error('역할 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 추가 (커스텀 역할) — 행 저장 + role_permissions 저장
export const fnCreateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strCode, strDisplayName, strDescription, arrPermissions } = req.body as Partial<IRole>;

    if (!strCode || !strDisplayName) {
      res.status(400).json({ bSuccess: false, strMessage: '역할 코드와 이름은 필수입니다.' });
      return;
    }

    const objExisting = fnFindRoleByCode(strCode);
    if (objExisting) {
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage: `[${strCode}] 역할 코드가 이미 존재합니다.`,
      });
      return;
    }

    const nId = fnGetNextRoleId();
    const strNow = new Date().toISOString();
    arrRoles.push({
      nId,
      strCode,
      strDisplayName,
      strDescription: strDescription || '',
      bIsSystem: false,
      dtCreatedAt: strNow,
      dtUpdatedAt: strNow,
    });
    const arrPerms = Array.isArray(arrPermissions) ? (arrPermissions as TPermission[]) : [];
    fnSaveRoleAndPermissions(nId, arrPerms);

    const objNewRole: IRole = {
      nId,
      strCode,
      strDisplayName,
      strDescription: strDescription || '',
      arrPermissions: arrPerms,
      bIsSystem: false,
      dtCreatedAt: strNow,
      dtUpdatedAt: strNow,
    };
    res.json({ bSuccess: true, strMessage: '역할이 생성되었습니다.', objRole: objNewRole });
  } catch (error) {
    console.error('역할 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 수정 — 행 수정 + role_permissions 갱신
export const fnUpdateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objRole = fnFindRoleRowById(nId);

    if (!objRole) {
      res.status(404).json({ bSuccess: false, strMessage: '역할을 찾을 수 없습니다.' });
      return;
    }

    const { strDisplayName, strDescription, arrPermissions } = req.body;

    if (objRole.bIsSystem) {
      if (Array.isArray(arrPermissions)) fnSaveRoleAndPermissions(nId, arrPermissions as TPermission[]);
    } else {
      if (strDisplayName !== undefined) objRole.strDisplayName = strDisplayName;
      if (strDescription !== undefined) objRole.strDescription = strDescription;
      if (Array.isArray(arrPermissions)) fnSaveRoleAndPermissions(nId, arrPermissions as TPermission[]);
    }
    objRole.dtUpdatedAt = new Date().toISOString();
    fnSaveRoles();

    const arrPerms = fnGetPermissionsByRoleId(nId);
    res.json({
      bSuccess: true,
      strMessage: '역할이 수정되었습니다.',
      objRole: { ...objRole, arrPermissions: arrPerms },
    });
  } catch (error) {
    console.error('역할 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 삭제 (커스텀 역할만) — user_roles 사용 여부 확인 후 행·권한 삭제
export const fnDeleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objRole = fnFindRoleRowById(nId);

    if (!objRole) {
      res.status(404).json({ bSuccess: false, strMessage: '역할을 찾을 수 없습니다.' });
      return;
    }

    if (objRole.bIsSystem) {
      res.status(400).json({ bSuccess: false, strMessage: '시스템 기본 역할은 삭제할 수 없습니다.' });
      return;
    }

    const bInUse = arrUserRoles.some((ur) => ur.nRoleId === nId);
    if (bInUse) {
      res.status(400).json({
        bSuccess: false,
        strMessage: '해당 역할을 사용 중인 사용자가 있어 삭제할 수 없습니다.',
      });
      return;
    }

    const nIndex = arrRoles.findIndex((r) => r.nId === nId);
    arrRoles.splice(nIndex, 1);
    fnRemoveRolePermissionsAndSave(nId);
    fnSaveRoles();
    res.json({ bSuccess: true, strMessage: '역할이 삭제되었습니다.' });
  } catch (error) {
    console.error('역할 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
