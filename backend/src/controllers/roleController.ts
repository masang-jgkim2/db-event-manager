import { Request, Response } from 'express';
import { arrRoles, fnGetNextRoleId, fnFindRoleByCode } from '../data/roles';
import { arrUsers } from '../data/users';
import { IRole, TPermission } from '../types';

// 역할 목록 조회
export const fnGetRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ bSuccess: true, arrRoles });
  } catch (error) {
    console.error('역할 목록 조회 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 추가 (커스텀 역할)
export const fnCreateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strCode, strDisplayName, strDescription, arrPermissions } = req.body as Partial<IRole>;

    if (!strCode || !strDisplayName) {
      res.status(400).json({ bSuccess: false, strMessage: '역할 코드와 이름은 필수입니다.' });
      return;
    }

    // 중복 코드 확인
    const objExisting = fnFindRoleByCode(strCode);
    if (objExisting) {
      res.status(400).json({ bSuccess: false, strMessage: '이미 존재하는 역할 코드입니다.' });
      return;
    }

    const objNewRole: IRole = {
      nId: fnGetNextRoleId(),
      strCode,
      strDisplayName,
      strDescription: strDescription || '',
      arrPermissions: Array.isArray(arrPermissions) ? arrPermissions : [],
      bIsSystem: false,  // 커스텀 역할
      dtCreatedAt: new Date().toISOString(),
      dtUpdatedAt: new Date().toISOString(),
    };

    arrRoles.push(objNewRole);
    res.json({ bSuccess: true, strMessage: '역할이 생성되었습니다.', objRole: objNewRole });
  } catch (error) {
    console.error('역할 생성 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 수정
export const fnUpdateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objRole = arrRoles.find((r) => r.nId === nId);

    if (!objRole) {
      res.status(404).json({ bSuccess: false, strMessage: '역할을 찾을 수 없습니다.' });
      return;
    }

    const { strDisplayName, strDescription, arrPermissions } = req.body;

    // 시스템 역할은 권한만 수정 가능
    if (objRole.bIsSystem) {
      if (Array.isArray(arrPermissions)) {
        objRole.arrPermissions = arrPermissions as TPermission[];
      }
    } else {
      // 커스텀 역할은 모든 항목 수정 가능 (코드 제외)
      if (strDisplayName !== undefined) objRole.strDisplayName = strDisplayName;
      if (strDescription !== undefined) objRole.strDescription = strDescription;
      if (Array.isArray(arrPermissions)) objRole.arrPermissions = arrPermissions as TPermission[];
    }

    objRole.dtUpdatedAt = new Date().toISOString();
    res.json({ bSuccess: true, strMessage: '역할이 수정되었습니다.', objRole });
  } catch (error) {
    console.error('역할 수정 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// 역할 삭제 (커스텀 역할만, 사용 중인 역할은 차단)
export const fnDeleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objRole = arrRoles.find((r) => r.nId === nId);

    if (!objRole) {
      res.status(404).json({ bSuccess: false, strMessage: '역할을 찾을 수 없습니다.' });
      return;
    }

    // 시스템 역할 삭제 차단
    if (objRole.bIsSystem) {
      res.status(400).json({ bSuccess: false, strMessage: '시스템 기본 역할은 삭제할 수 없습니다.' });
      return;
    }

    // 해당 역할을 사용 중인 사용자가 있는지 확인
    const bInUse = arrUsers.some((u) => u.arrRoles.includes(objRole.strCode));
    if (bInUse) {
      res.status(400).json({
        bSuccess: false,
        strMessage: '해당 역할을 사용 중인 사용자가 있어 삭제할 수 없습니다.',
      });
      return;
    }

    const nIndex = arrRoles.findIndex((r) => r.nId === nId);
    arrRoles.splice(nIndex, 1);
    res.json({ bSuccess: true, strMessage: '역할이 삭제되었습니다.' });
  } catch (error) {
    console.error('역할 삭제 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
