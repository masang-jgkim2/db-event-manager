import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  STR_ADMIN_PASS,
  STR_ADMIN_USER,
  fnBuildE2eRegisterUserId,
  fnE2eLogin,
  fnHeaderLogout,
} from './helpers/auth';

const STR_E2E_REGISTER_PASS = 'E2eTest1234!';

const fnFindPendingUserRow = async (page: Page, strUserId: string) => {
  for (let n = 0; n < 15; n++) {
    const row = page
      .locator('.ant-table tbody tr:not(.ant-table-measure-row)')
      .filter({ has: page.locator('code', { hasText: strUserId }) });
    if (await row.count()) return row.first();
    const next = page.locator('.ant-pagination-next:not(.ant-pagination-disabled)');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(300);
  }
  return page
    .locator('.ant-table tbody tr:not(.ant-table-measure-row)')
    .filter({ has: page.locator('code', { hasText: strUserId }) })
    .first();
};

const fnApprovePendingUserWithGm = async (page: Page, row: Locator) => {
  await row.getByRole('button', { name: '승인' }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: '가입 승인' });
  await expect(modal).toBeVisible();
  if ((await modal.locator('.ant-select-selection-item').count()) === 0) {
    await modal.getByRole('combobox', { name: /부여할 역할/ }).click();
    const opt = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'GM' })
      .first();
    await opt.scrollIntoViewIfNeeded();
    await opt.click();
    await expect(modal.locator('.ant-select-selection-item').first()).toBeVisible({ timeout: 5000 });
  }
  await page.keyboard.press('Escape');
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/approve') && r.request().method() === 'PATCH',
  );
  await modal.getByRole('button', { name: '승인', exact: true }).click();
  const resp = await respPromise;
  expect(resp.ok()).toBeTruthy();
  await expect(modal).toBeHidden({ timeout: 15000 });
};

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

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(
      page.locator('.ant-message-notice-content, .ant-notification-notice-message').filter({
        hasText: /승인|대기|로그인할 수 없/i,
      }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('A-09 관리자 승인 후 로그인', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    test.skip(!strNewUserId, '가입 단계 실패 시 스킵');
    test.setTimeout(120000);

    await fnE2eLogin(page, STR_ADMIN_USER, STR_ADMIN_PASS);
    await page.goto('/users');
    await page.locator('.ant-segmented-item').filter({ hasText: /승인 대기/ }).click();
    await expect(page.getByRole('radio', { name: /승인 대기/ })).toBeChecked({ timeout: 10000 });

    const row = await fnFindPendingUserRow(page, strNewUserId);
    await expect(row).toBeVisible({ timeout: 30000 });
    await fnApprovePendingUserWithGm(page, row);

    await fnHeaderLogout(page);

    await fnE2eLogin(page, strNewUserId, STR_E2E_REGISTER_PASS);
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
