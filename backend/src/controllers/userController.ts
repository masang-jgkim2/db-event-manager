import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  arrUsers,
  fnFindUserRowById,
  fnGetNextId,
  fnGetUsersWithRoles,
  fnSaveUserAndRoles,
  fnCommitUserDataStore,
  fnReloadUsersFromMysql,
  fnSaveUsers,
} from '../data/users';
import { fnGetMergedPermissions, fnGetRoleIdsByRoleCodes } from '../data/roles';
import { fnGetRoleIdsByUserId, fnRemoveUserRolesAndSave } from '../data/userRoles';
import { fnReassignUserReferencesInEventInstances } from '../services/userEventReassign';
import { fnAwaitInFlightMysqlDocFlush, fnCancelAllPendingMysqlDocFlush } from '../db/mysqlDocPersist';
import { fnGetUserLastSeenIso, fnIsUserOnlineByPresence, fnMarkUserOffline } from '../services/userPresence';
import type { TUserStatus } from '../types/userStatus';
import { STR_USER_STATUS_ACTIVE, STR_USER_STATUS_PENDING_APPROVAL, STR_USER_STATUS_REJECTED } from '../types/userStatus';
import { fnIsMasangsoftEmail, fnNormalizeUserId, REG_USER_ID } from '../types/userStatus';

// 사용자 목록 조회 (정규화: user_roles에서 역할 조립)
export const fnGetUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const strStatus = typeof req.query.strStatus === 'string' ? req.query.strStatus as TUserStatus : undefined;
    const arrWithRoles = fnGetUsersWithRoles(strStatus);
    const arrSafeUsers = arrWithRoles.map((u) => ({
      nId:            u.nId,
      strUserId:      u.strUserId,
      strDisplayName: u.strDisplayName,
      strEmail:       u.strEmail ?? null,
      strStatus:      u.strStatus ?? STR_USER_STATUS_ACTIVE,
      arrRoles:       u.arrRoles,
      arrPermissions: fnGetMergedPermissions(u.arrRoles),
      dtCreatedAt:    u.dtCreatedAt,
      bOnline:        fnIsUserOnlineByPresence(u.nId),
      strLastSeenAt:  fnGetUserLastSeenIso(u.nId),
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
    const { strUserId, strPassword, strDisplayName, strEmail, arrRoles: arrRoleCodes } = req.body;

    if (!strUserId || !strPassword || !strDisplayName || !Array.isArray(arrRoleCodes) || arrRoleCodes.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '모든 필드를 입력해주세요. 역할은 최소 1개 이상 필요합니다.' });
      return;
    }
    const strUserIdNorm = fnNormalizeUserId(String(strUserId));
    if (!REG_USER_ID.test(strUserIdNorm)) {
      res.status(400).json({ bSuccess: false, strMessage: '아이디는 영문·숫자만 4~32자 사용할 수 있습니다.' });
      return;
    }
    if (strEmail && typeof strEmail === 'string' && !fnIsMasangsoftEmail(strEmail)) {
      res.status(400).json({ bSuccess: false, strMessage: '사내 이메일(@masangsoft.com)만 등록할 수 있습니다.' });
      return;
    }

    const objExisting = arrUsers.find((u) => u.strUserId === strUserIdNorm);
    if (objExisting) {
      res.status(409).json({
        bSuccess: false,
        strErrorCode: 'DUPLICATE',
        strMessage: `[${strUserIdNorm}] 아이디가 이미 존재합니다.`,
      });
      return;
    }

    const nId = fnGetNextId();
    const strHashedPassword = await bcrypt.hash(strPassword, 10);
    arrUsers.push({
      nId,
      strUserId: strUserIdNorm,
      strPassword: strHashedPassword,
      strDisplayName,
      strEmail: typeof strEmail === 'string' && strEmail.trim() ? strEmail.trim().toLowerCase() : null,
      strStatus: STR_USER_STATUS_ACTIVE,
      dtCreatedAt: new Date().toISOString(),
    });
    const arrRoleIds = fnGetRoleIdsByRoleCodes(arrRoleCodes);
    fnSaveUserAndRoles(nId, arrRoleIds);
    await fnCommitUserDataStore();

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
    await fnCommitUserDataStore();

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

    await fnAwaitInFlightMysqlDocFlush();
    fnCancelAllPendingMysqlDocFlush();

    const nReassignToUserId = req.user?.nId ?? 1;
    const strReassignToName =
      arrUsers.find((u) => u.nId === nReassignToUserId)?.strDisplayName ?? '관리자';

    let objReassign = { nCreatedInstances: 0, nStageActorRows: 0, nStatusLogRows: 0 };
    try {
      objReassign = await fnReassignUserReferencesInEventInstances(nId, nReassignToUserId);
    } catch (errReassign: unknown) {
      console.error('[사용자 삭제] 이벤트 참조 이관 실패 |', (errReassign as Error)?.message);
      res.status(500).json({
        bSuccess: false,
        strMessage: '이벤트 데이터 이관에 실패하여 사용자를 삭제할 수 없습니다.',
      });
      return;
    }

    fnRemoveUserRolesAndSave(nId);
    arrUsers.splice(nIndex, 1);
    try {
      await fnCommitUserDataStore();
    } catch (errCommit: unknown) {
      await fnReloadUsersFromMysql();
      console.error('[사용자 삭제] MySQL 반영 실패 — DB 기준 복구 |', (errCommit as Error)?.message);
      res.status(500).json({
        bSuccess: false,
        strMessage: '사용자 삭제 저장에 실패했습니다. 목록을 새로고침해 주세요.',
      });
      return;
    }

    const bHadRefs =
      objReassign.nCreatedInstances > 0
      || objReassign.nStageActorRows > 0
      || objReassign.nStatusLogRows > 0;
    const strMessage = bHadRefs
      ? `사용자가 삭제되었습니다. (생성 이벤트 ${objReassign.nCreatedInstances}건, 처리 이력 ${objReassign.nStageActorRows}건, 상태 로그 ${objReassign.nStatusLogRows}건은 ${strReassignToName}(으)로 이관됨)`
      : '사용자가 삭제되었습니다.';

    res.json({ bSuccess: true, strMessage });
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
    await fnCommitUserDataStore();
    res.json({ bSuccess: true, strMessage: '비밀번호가 초기화되었습니다.' });
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// PATCH /api/users/:id/approve — 가입 승인 + 역할 부여
export const fnApproveUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const arrRoleCodes = req.body?.arrRoles as string[] | undefined;
    if (!Array.isArray(arrRoleCodes) || arrRoleCodes.length === 0) {
      res.status(400).json({ bSuccess: false, strMessage: '승인 시 부여할 역할을 1개 이상 선택해주세요.' });
      return;
    }
    const objRow = fnFindUserRowById(nId);
    if (!objRow) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }
    if ((objRow.strStatus ?? STR_USER_STATUS_ACTIVE) !== STR_USER_STATUS_PENDING_APPROVAL) {
      res.status(400).json({ bSuccess: false, strMessage: '승인 대기 상태의 사용자만 승인할 수 있습니다.' });
      return;
    }
    const strStatusBefore = objRow.strStatus ?? STR_USER_STATUS_ACTIVE;
    const arrRoleIdsBefore = [...fnGetRoleIdsByUserId(nId)];
    objRow.strStatus = STR_USER_STATUS_ACTIVE;
    const arrRoleIds = fnGetRoleIdsByRoleCodes(arrRoleCodes);
    fnSaveUserAndRoles(nId, arrRoleIds);
    try {
      await fnCommitUserDataStore();
    } catch (errPersist: unknown) {
      objRow.strStatus = strStatusBefore;
      fnSaveUserAndRoles(nId, arrRoleIdsBefore);
      console.error('[사용자 승인] MySQL 반영 실패 |', errPersist);
      res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
      return;
    }
    console.log(`[사용자 승인] nId=${nId} | roles=${arrRoleCodes.join(',')}`);
    res.json({ bSuccess: true, strMessage: '가입이 승인되었습니다.' });
  } catch (error) {
    console.error('[사용자 승인] 오류 |', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};

// PATCH /api/users/:id/reject — 가입 거절
export const fnRejectUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const nId = Number(req.params.id);
    const objRow = fnFindUserRowById(nId);
    if (!objRow) {
      res.status(404).json({ bSuccess: false, strMessage: '사용자를 찾을 수 없습니다.' });
      return;
    }
    if ((objRow.strStatus ?? STR_USER_STATUS_ACTIVE) !== STR_USER_STATUS_PENDING_APPROVAL) {
      res.status(400).json({ bSuccess: false, strMessage: '승인 대기 상태의 사용자만 거절할 수 있습니다.' });
      return;
    }
    const strStatusBefore = objRow.strStatus ?? STR_USER_STATUS_ACTIVE;
    objRow.strStatus = STR_USER_STATUS_REJECTED;
    fnSaveUsers();
    try {
      await fnCommitUserDataStore();
    } catch (errPersist: unknown) {
      objRow.strStatus = strStatusBefore;
      fnSaveUsers();
      console.error('[사용자 거절] MySQL 반영 실패 |', errPersist);
      res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
      return;
    }
    fnMarkUserOffline(nId);
    console.log(`[사용자 거절] nId=${nId}`);
    res.json({
      bSuccess: true,
      strMessage: '가입이 거절되었습니다. 해당 계정은 로그인할 수 없으며, 사용자 목록에는 «거절» 상태로만 남습니다.',
    });
  } catch (error) {
    console.error('[사용자 거절] 오류 |', error);
    res.status(500).json({ bSuccess: false, strMessage: '서버 오류가 발생했습니다.' });
  }
};
