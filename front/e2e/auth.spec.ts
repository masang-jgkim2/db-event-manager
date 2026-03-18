import { test, expect } from '@playwright/test';

// E2E 테스트용 계정 (백엔드 시드와 동일. 필요 시 env로 오버라이드)
const STR_E2E_USER = process.env.E2E_USER_ID || 'admin';
const STR_E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

test.describe('로그인·로그아웃 (화면 클릭)', () => {
  test('로그인 페이지 접속 시 아이디/비밀번호 입력란과 로그인 버튼이 보인다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('아이디')).toBeVisible();
    await expect(page.getByPlaceholder('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('올바른 계정으로 로그인하면 메인 레이아웃으로 이동한다', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_E2E_USER);
    await page.getByPlaceholder('비밀번호').fill(STR_E2E_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 성공 시 대시보드(또는 권한에 따른 첫 페이지)로 이동 — URL이 /login 이 아니고, 레이아웃(사이드 메뉴 등)이 보여야 함
    await expect(page).not.toHaveURL(/\/login$/);
    // 관리자면 대시보드, 그 외는 나의 대시보드 등
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 10000 });
  });

  test('잘못된 비밀번호로 로그인하면 에러 메시지가 뜬다', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_E2E_USER);
    await page.getByPlaceholder('비밀번호').fill('wrongpassword');
    await page.getByRole('button', { name: '로그인' }).click();

    // Ant Design message 또는 에러 문구
    await expect(page.getByText(/아이디|비밀번호|올바르지 않습니다/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('로그아웃 (클릭)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('아이디').fill(STR_E2E_USER);
    await page.getByPlaceholder('비밀번호').fill(STR_E2E_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 10000 });
  });

  test('헤더에서 사용자 영역 클릭 후 로그아웃 클릭하면 로그인 페이지로 이동한다', async ({ page }) => {
    // 우측 상단 사용자 표시명(관리자) 클릭 → 드롭다운에서 로그아웃 클릭
    await page.getByText('관리자', { exact: true }).first().click();
    await page.getByRole('menuitem', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
