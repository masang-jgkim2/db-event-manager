import { test, expect } from '@playwright/test';
import { STR_ADMIN_PASS, STR_ADMIN_USER, fnE2eLogin, fnHeaderLogout } from './helpers/auth';

test.describe('로그인·로그아웃 (화면 클릭)', { tag: '@smoke' }, () => {
  test('로그인 페이지 접속 시 아이디/비밀번호 입력란과 로그인 버튼이 보인다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('아이디')).toBeVisible();
    await expect(page.getByPlaceholder('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('올바른 계정으로 로그인하면 메인 레이아웃으로 이동한다', async ({ page }) => {
    await fnE2eLogin(page, STR_ADMIN_USER, STR_ADMIN_PASS);
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('잘못된 비밀번호로 로그인하면 에러 메시지가 뜬다', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_ADMIN_USER);
    await page.getByPlaceholder('비밀번호').fill('wrongpassword');
    await page.getByRole('button', { name: '로그인' }).click();

    // Ant Design message 또는 에러 문구
    await expect(page.getByText(/아이디|비밀번호|올바르지 않습니다/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('로그아웃 (클릭)', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_ADMIN_USER);
    await page.getByPlaceholder('비밀번호').fill(STR_ADMIN_PASS);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 10000 });
  });

  test('헤더에서 사용자 영역 클릭 후 로그아웃 클릭하면 로그인 페이지로 이동한다', async ({ page }) => {
    await fnHeaderLogout(page);
    await expect(page).toHaveURL(/\/login$/);
  });
});
