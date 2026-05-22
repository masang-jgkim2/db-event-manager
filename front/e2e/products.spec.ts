import { test, expect } from '@playwright/test';

const STR_E2E_USER = process.env.E2E_USER_ID || 'admin';
const STR_E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

test.describe('프로덕트 페이지 — 버튼·모달 클릭', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_E2E_USER);
    await page.getByPlaceholder('비밀번호').fill(STR_E2E_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 10000 });
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
