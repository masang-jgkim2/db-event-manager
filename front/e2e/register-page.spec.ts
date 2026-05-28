import { test, expect } from '@playwright/test';

test.describe('회원가입 화면', () => {
  test('A-05 로그인에서 회원가입 링크 · 폼 표시', { tag: ['@automate', '@smoke'] }, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /회원 가입|가입/ }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByPlaceholder('로그인에 사용할 아이디')).toBeVisible();
    await expect(page.getByRole('button', { name: '가입 신청' })).toBeVisible();
  });
});
