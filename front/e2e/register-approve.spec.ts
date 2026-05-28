import { test, expect } from '@playwright/test';
import {
  STR_ADMIN_PASS,
  STR_ADMIN_USER,
  fnBuildE2eRegisterUserId,
  fnE2eLogin,
} from './helpers/auth';

const STR_E2E_REGISTER_PASS = 'E2eTest1234!';

test.describe('회원가입 → 승인 대기 로그인 차단 → 관리자 승인', () => {
  test.describe.configure({ mode: 'serial' });

  let strNewUserId: string;

  test('A-05~A-07 가입 신청 성공', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    strNewUserId = fnBuildE2eRegisterUserId();

    await page.goto('/register');
    await expect(page.getByText('회원 가입')).toBeVisible();

    const inpUserId = page.getByPlaceholder('로그인에 사용할 아이디');
    await inpUserId.fill(strNewUserId);
    await inpUserId.blur();
    await expect(page.getByText('사용 가능한 아이디입니다.')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('표시 이름').fill('E2E가입테스트');
    await page.getByPlaceholder('비밀번호', { exact: true }).fill(STR_E2E_REGISTER_PASS);
    await page.getByPlaceholder('비밀번호 확인').fill(STR_E2E_REGISTER_PASS);
    await page.getByRole('checkbox', { name: /동의/ }).check();
    await page.getByRole('button', { name: '가입 신청' }).click();

    await expect(page).toHaveURL(/\/register\/sent/, { timeout: 15000 });
    await expect(page.getByText('관리자 승인 대기')).toBeVisible();
  });

  test('A-08 승인 전 로그인 차단', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    test.skip(!strNewUserId, '가입 단계 실패 시 스킵');

    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(strNewUserId);
    await page.getByPlaceholder('비밀번호').fill(STR_E2E_REGISTER_PASS);
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText(/승인|대기|로그인할 수 없/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('A-09 관리자 승인 후 로그인', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    test.skip(!strNewUserId, '가입 단계 실패 시 스킵');

    await fnE2eLogin(page, STR_ADMIN_USER, STR_ADMIN_PASS);
    await page.goto('/users');
    await page.getByRole('tab', { name: /승인 대기/ }).click();

    const row = page.locator('.ant-table tbody tr').filter({ hasText: strNewUserId });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: '승인' }).click();

    const modal = page.locator('.ant-modal').filter({ hasText: '가입 승인' });
    await expect(modal).toBeVisible();
    await modal.locator('.ant-select').click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .getByText('GM', { exact: true })
      .click();
    await modal.getByRole('button', { name: '승인', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 15000 });

    await page.getByText('관리자', { exact: true }).first().click();
    await page.getByRole('menuitem', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login/);

    await fnE2eLogin(page, strNewUserId, STR_E2E_REGISTER_PASS);
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
