/**
 * 로그인 화면 기본 계정(admin) 안내 블록 표시 여부 — 빌드/배포 시 코드(.env)로만 제어
 *
 * - .env: VITE_SHOW_LOGIN_DEFAULT_ACCOUNT_HINT=true 로 켬
 * - 미설정: 비활성화(안내 블록 숨김)
 */
const fnParseEnvTriBool = (str: string | undefined): boolean | null => {
  if (str == null || str === '') return null;
  const s = str.trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return null;
};

const bFromEnv = fnParseEnvTriBool(import.meta.env.VITE_SHOW_LOGIN_DEFAULT_ACCOUNT_HINT);

export const bShowLoginDefaultAccountHint: boolean =
  bFromEnv !== null ? bFromEnv : false;
