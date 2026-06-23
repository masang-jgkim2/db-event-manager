import { test, expect } from '@playwright/test';
import { STR_ADMIN_PASS, STR_ADMIN_USER, fnE2eLogin } from './helpers/auth';

test.describe('프로덕트 페이지 — 버튼·모달 클릭', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_ADMIN_USER, STR_ADMIN_PASS);
    await page.getByRole('menuitem', { name: '프로덕트' }).click();
    await expect(page).toHaveURL('/products');
  });

  test('추가 버튼 클릭 시 프로덕트 등록 모달이 열린다', async ({ page }) => {
    await page.getByRole('button', { name: '새로운 프로덕트' }).click();
    await expect(page.getByRole('dialog').getByText(/프로덕트 추가/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('dialog').locator('input').first()).toBeVisible();
  });

  test('모달 열린 뒤 취소/닫기 클릭 시 모달이 사라진다', async ({ page }) => {
    await page.getByRole('button', { name: '새로운 프로덕트' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '취소' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
