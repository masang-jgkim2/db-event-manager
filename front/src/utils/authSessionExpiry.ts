/** JWT 만료 등 API 401 시 로컬 세션 정리·로그인 이동 (axios ↔ store 순환 import 방지용 분리) */

const STR_SESSION_EXPIRED_KEY = 'dqpm_session_expired';

const ARR_SKIP_API_PATH_SNIPPETS = ['/auth/login', '/auth/register'];

const ARR_PUBLIC_PAGE_PREFIXES = ['/login', '/register'];

let bRedirectingForExpiry = false;

export function fnShouldSkipSessionExpiryForApiUrl(strUrl: string): boolean {
  return ARR_SKIP_API_PATH_SNIPPETS.some((strSnippet) => strUrl.includes(strSnippet));
}

function fnIsPublicAppPath(strPath: string): boolean {
  return ARR_PUBLIC_PAGE_PREFIXES.some(
    (strPrefix) => strPath === strPrefix || strPath.startsWith(`${strPrefix}/`),
  );
}

function fnClearLocalAuthState(): void {
  localStorage.removeItem('strToken');
  void import('../stores/useAuthStore').then(({ useAuthStore }) => {
    useAuthStore.setState({
      user: null,
      strToken: null,
      bIsAuthenticated: false,
      bIsLoading: false,
    });
  });
}

/** API 401 — 로그인 실패 요청 제외, 중복 리다이렉트 방지 */
export function fnHandleSessionExpiredFromApi(strRequestUrl?: string): void {
  if (typeof window === 'undefined') return;
  if (strRequestUrl && fnShouldSkipSessionExpiryForApiUrl(strRequestUrl)) return;
  if (bRedirectingForExpiry) return;

  if (fnIsPublicAppPath(window.location.pathname)) {
    fnClearLocalAuthState();
    return;
  }

  bRedirectingForExpiry = true;
  sessionStorage.setItem(STR_SESSION_EXPIRED_KEY, '1');
  fnClearLocalAuthState();

  const strRedirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?redirect=${strRedirect}&session=expired`);
}

export function fnConsumeSessionExpiredFlag(): boolean {
  const bExpired = sessionStorage.getItem(STR_SESSION_EXPIRED_KEY) === '1';
  sessionStorage.removeItem(STR_SESSION_EXPIRED_KEY);
  return bExpired;
}
