import { test, expect } from '@playwright/test';
import { STR_GM_PASS, STR_GM_USER, fnE2eLogin } from './helpers/auth';
import { fnClickSidebarMenu, fnSidebarMenuTitle } from './helpers/menu';

test.describe('gm01 메뉴·페이지', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_GM_USER, STR_GM_PASS);
  });

  test('B-gm01 GM 메뉴 노출·숨김', async ({ page }) => {
    // GM(game_manager) — dashboard.view 없음, product·템플릿·운영 메뉴만
    for (const str of ['프로덕트', '쿼리 템플릿', '나의 대시보드', '이벤트 생성']) {
      await expect(fnSidebarMenuTitle(page, str)).toBeVisible();
    }
    for (const str of ['대시보드', '사용자', '역할 권한', 'DB 접속 정보']) {
      await expect(fnSidebarMenuTitle(page, str)).toHaveCount(0);
    }
  });

  test('B-08 이벤트 생성 페이지', async ({ page }) => {
    await fnClickSidebarMenu(page, '이벤트 생성');
    await expect(page).toHaveURL(/\/query/);
    await expect(page.getByText(/이벤트|템플릿|프로덕트/i).first()).toBeVisible();
  });

  test('B-07 나의 대시보드', async ({ page }) => {
    await fnClickSidebarMenu(page, '나의 대시보드');
    await expect(page).toHaveURL('/my-dashboard');
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });
  });
});
