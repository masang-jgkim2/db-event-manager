import type { IUser } from '../types';
import type { TUserStatus } from '../types/userStatus';
import { STR_ROLE_GUEST, STR_USER_STATUS_PENDING_APPROVAL } from '../types/userStatus';
import { fnExpandPermissions, fnGetMergedPermissions } from '../data/roles';
import { fnFindUserRowById } from '../data/users';

/** API·JWT용 사용자 + 권한 (승인 대기 시 guest 권한만) */
export const fnBuildAuthUserPayload = (objUser: IUser): {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strEmail: string | null;
  strStatus: TUserStatus;
  arrRoles: string[];
  arrPermissions: string[];
} => {
  const row = fnFindUserRowById(objUser.nId);
  const strStatus = (row?.strStatus ?? 'active') as TUserStatus;
  const strEmail = row?.strEmail ?? null;
  let arrRoles = [...objUser.arrRoles];
  let arrRaw = fnGetMergedPermissions(arrRoles);

  if (strStatus === STR_USER_STATUS_PENDING_APPROVAL) {
    arrRoles = [STR_ROLE_GUEST];
    arrRaw = fnGetMergedPermissions(arrRoles);
  }

  const arrPermissions = fnExpandPermissions(arrRaw, arrRoles);
  return {
    nId: objUser.nId,
    strUserId: objUser.strUserId,
    strDisplayName: objUser.strDisplayName,
    strEmail,
    strStatus,
    arrRoles,
    arrPermissions,
  };
};
