export type TUserStatus =
  | 'active'
  | 'pending_email'
  | 'pending_approval'
  | 'rejected'
  | 'disabled';

export const STR_EMAIL_DOMAIN = '@masangsoft.com';

export const OBJ_USER_STATUS_LABEL: Record<TUserStatus, string> = {
  active: '활성',
  pending_email: '이메일 미인증',
  pending_approval: '승인 대기',
  rejected: '거절',
  disabled: '비활성',
};

export const OBJ_USER_STATUS_COLOR: Record<TUserStatus, string> = {
  active: 'green',
  pending_email: 'blue',
  pending_approval: 'gold',
  rejected: 'red',
  disabled: 'default',
};

export const fnIsMasangsoftEmail = (strEmail: string): boolean => {
  const s = strEmail.trim().toLowerCase();
  return s.endsWith(STR_EMAIL_DOMAIN) && s.length > STR_EMAIL_DOMAIN.length;
};

export const fnBuildMasangsoftEmail = (strLocal: string): string =>
  `${strLocal.trim().toLowerCase()}${STR_EMAIL_DOMAIN}`;

const REG_EMAIL_LOCAL = /^[a-z0-9._-]+$/;

export const fnIsValidEmailLocalPart = (strLocal: string): boolean => {
  const s = strLocal.trim().toLowerCase();
  return s.length >= 1 && s.length <= 64 && REG_EMAIL_LOCAL.test(s);
};
