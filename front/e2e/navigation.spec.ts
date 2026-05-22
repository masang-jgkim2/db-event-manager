import { test, expect } from '@playwright/test';

const STR_E2E_USER = process.env.E2E_USER_ID || 'admin';
const STR_E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

test.describe('메뉴 클릭으로 페이지 이동', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_E2E_USER);
    await page.getByPlaceholder('비밀번호').fill(STR_E2E_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 10000 });
  });

  test('대시보드 메뉴 클릭 시 대시보드 페이지가 보인다', async ({ page }) => {
    // 사이드바 메뉴에서 루트 대시보드 클릭 (첫 번째 메뉴 = /)
    await page.getByRole('menuitem').first().click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/대시보드|프로덕트|이벤트/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('프로덕트 메뉴 클릭 시 프로덕트 목록 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: '프로덕트' }).click();
    await expect(page).toHaveURL('/products');
    await expect(page.getByRole('heading', { name: '프로덕트 관리' })).toBeVisible({ timeout: 5000 });
  });

  test('쿼리 템플릿 메뉴 클릭 시 쿼리 템플릿 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: '쿼리 템플릿' }).click();
    await expect(page).toHaveURL('/events');
    await expect(page.getByRole('heading', { name: '쿼리 템플릿' })).toBeVisible({ timeout: 5000 });
  });

  test('나의 대시보드 메뉴 클릭 시 나의 대시보드 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: '나의 대시보드' }).click();
    await expect(page).toHaveURL('/my-dashboard');
    await expect(page.getByText(/나의 대시보드|대시보드/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('DB 접속 정보 메뉴 클릭 시 DB 접속 목록 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'DB 접속 정보' }).click();
    await expect(page).toHaveURL('/db-connections');
    await expect(page.getByText(/DB 접속|접속 정보/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('사용자 메뉴 클릭 시 사용자 목록 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: '사용자' }).click();
    await expect(page).toHaveURL('/users');
    await expect(page.getByText(/사용자/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('역할 권한 메뉴 클릭 시 역할 권한 페이지가 보인다', async ({ page }) => {
    await page.getByRole('menuitem', { name: '역할 권한' }).click();
    await expect(page).toHaveURL('/roles');
    await expect(page.getByText(/역할|권한/i).first()).toBeVisible({ timeout: 5000 });
  });
});
