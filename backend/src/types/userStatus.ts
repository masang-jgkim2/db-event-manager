/** 계정 온보딩 상태 — Phase A: pending_approval(이메일 인증 UI 보류, 가입 직후) */
export type TUserStatus =
  | 'active'
  | 'pending_email'
  | 'pending_approval'
  | 'rejected'
  | 'disabled';

export const STR_USER_STATUS_ACTIVE: TUserStatus = 'active';
export const STR_USER_STATUS_PENDING_APPROVAL: TUserStatus = 'pending_approval';
export const STR_USER_STATUS_REJECTED: TUserStatus = 'rejected';
export const STR_ROLE_GUEST = 'guest';
export const STR_EMAIL_DOMAIN = '@masangsoft.com';

/** 아이디: 영문·숫자만, 4~32자 (소문자 저장) */
export const REG_USER_ID = /^[a-z0-9]{4,32}$/;

export const fnNormalizeUserId = (strUserId: string): string =>
  strUserId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

export const fnIsMasangsoftEmail = (strEmail: string): boolean => {
  const strNorm = strEmail.trim().toLowerCase();
  return strNorm.endsWith(STR_EMAIL_DOMAIN) && strNorm.length > STR_EMAIL_DOMAIN.length;
};

/** 이메일 로컬 파트 → 사내 전체 주소 */
export const fnBuildMasangsoftEmail = (strLocal: string): string => {
  const strNorm = strLocal.trim().toLowerCase();
  return `${strNorm}${STR_EMAIL_DOMAIN}`;
};

const REG_EMAIL_LOCAL = /^[a-z0-9._-]+$/;

export const fnIsValidEmailLocalPart = (strLocal: string): boolean => {
  const s = strLocal.trim().toLowerCase();
  return s.length >= 1 && s.length <= 64 && REG_EMAIL_LOCAL.test(s);
};

/** 로그인·API 차단 사유 (없으면 null) */
export const fnGetUserAuthBlock = (
  strStatus: TUserStatus | string | undefined,
): { strErrorCode: string; strMessage: string } | null => {
  if (strStatus === 'pending_approval') {
    return {
      strErrorCode: 'pending_approval',
      strMessage: '관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.',
    };
  }
  if (strStatus === 'rejected') {
    return {
      strErrorCode: 'rejected',
      strMessage: '가입이 거절된 계정입니다. 관리자에게 문의하세요.',
    };
  }
  if (strStatus === 'disabled') {
    return {
      strErrorCode: 'disabled',
      strMessage: '비활성화된 계정입니다. 관리자에게 문의하세요.',
    };
  }
  return null;
};

/** 로그인 허용 여부 — 상태 + 가입 신청자(이메일 있음) 역할 없음 차단 */
export const fnGetUserLoginBlock = (
  strStatus: TUserStatus | string | undefined,
  arrRoles: string[] | undefined,
  strEmail?: string | null,
): { strErrorCode: string; strMessage: string } | null => {
  const objStatusBlock = fnGetUserAuthBlock(strStatus);
  if (objStatusBlock) return objStatusBlock;
  const bSelfRegistered = Boolean(strEmail?.trim());
  if (bSelfRegistered && (!arrRoles || arrRoles.length === 0)) {
    return {
      strErrorCode: 'no_roles',
      strMessage: '역할이 부여되지 않았습니다. 관리자 승인 후 로그인할 수 있습니다.',
    };
  }
  return null;
};
