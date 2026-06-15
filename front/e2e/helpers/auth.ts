import { expect, type Page } from '@playwright/test';

/** E2E 관리자 (승인·메뉴 smoke) */
export const STR_ADMIN_USER = process.env.E2E_USER_ID || 'admin';
export const STR_ADMIN_PASS = process.env.E2E_PASSWORD || 'admin123';

/** E2E DBA (나의 대시보드 실행 버튼 등) */
export const STR_DBA_USER = process.env.E2E_DBA_USER_ID || 'dba01';
export const STR_DBA_PASS = process.env.E2E_DBA_PASSWORD || 'dba01';

/** E2E GM (이벤트 생성·컨펌 요청·확인) */
export const STR_GM_USER = process.env.E2E_GM_USER_ID || 'gm01';
export const STR_GM_PASS = process.env.E2E_GM_PASSWORD || 'gm01';

/** E2E GM2 (선택 — 계정 없으면 풀·생성자 검증에서 제외) */
export const STR_GM2_USER = process.env.E2E_GM2_USER_ID || process.env.E2E_GM02_USER_ID || 'gm02';
export const STR_GM2_PASS = process.env.E2E_GM2_PASSWORD || process.env.E2E_GM02_PASSWORD || 'gm02';

export const fnE2eLogin = async (
  page: Page,
  strUserId: string,
  strPassword: string,
): Promise<void> => {
  await page.goto('/login');
  await page.getByPlaceholder(/아이디/).fill(strUserId);
  await page.getByPlaceholder('비밀번호').fill(strPassword);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20000 });
  await expect(page.locator('.ant-layout-sider')).toBeVisible({ timeout: 20000 });
};

/** 헤더 사용자 드롭다운 (Tooltip·역할 Tag 변경에도 안정적) */
export const fnOpenHeaderUserMenu = async (page: Page): Promise<void> => {
  await page.getByTestId('header-user-menu').click();
};

export const fnHeaderLogout = async (page: Page): Promise<void> => {
  await fnOpenHeaderUserMenu(page);
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
};

/** 고유 E2E 가입 아이디 (4~32자 영숫자) */
export const fnBuildE2eRegisterUserId = (): string => {
  const strSuffix = Date.now().toString(36).slice(-8);
  return `e2e${strSuffix}`.slice(0, 32);
};
