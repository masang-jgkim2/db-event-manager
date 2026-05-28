import { test, expect } from '@playwright/test';
import { STR_DBA_PASS, STR_DBA_USER, fnE2eLogin } from './helpers/auth';
import { fnClickSidebarMenu } from './helpers/menu';

/** dba01 — 이벤트·사용자 메뉴 (운영 그룹 제외) */
const arrMenus = [
  { strLabel: '대시보드', strPath: '/', fnCheck: (page: import('@playwright/test').Page) => page.getByText(/대시보드|프로덕트|이벤트 인스턴스/i).first() },
  { strLabel: '프로덕트', strPath: '/products', fnCheck: (page: import('@playwright/test').Page) => page.getByRole('heading', { name: '프로덕트 관리' }) },
  { strLabel: '쿼리 템플릿', strPath: '/events', fnCheck: (page: import('@playwright/test').Page) => page.getByRole('heading', { name: '쿼리 템플릿' }) },
  { strLabel: 'DB 접속 정보', strPath: '/db-connections', fnCheck: (page: import('@playwright/test').Page) => page.getByText(/DB 접속|접속 정보/i).first() },
  { strLabel: '사용자', strPath: '/users', fnCheck: (page: import('@playwright/test').Page) => page.getByRole('heading', { name: '사용자' }) },
  { strLabel: '역할 권한', strPath: '/roles', fnCheck: (page: import('@playwright/test').Page) => page.getByText(/역할|권한/i).first() },
  { strLabel: '활동', strPath: '/activity', fnCheck: (page: import('@playwright/test').Page) => page.getByText(/활동/i).first() },
];

test.describe('dba01 메뉴 (운영 제외)', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await fnE2eLogin(page, STR_DBA_USER, STR_DBA_PASS);
  });

  for (const item of arrMenus) {
    test(`B-dba ${item.strLabel} 페이지`, async ({ page }) => {
      try {
        await fnClickSidebarMenu(page, item.strLabel);
      } catch {
        await page.goto(item.strPath);
      }
      await expect(item.fnCheck(page)).toBeVisible({ timeout: 10000 });
      if (item.strPath === '/') {
        await expect(page).not.toHaveURL(/\/login/);
      } else {
        await expect(page).toHaveURL(item.strPath);
      }
    });
  }
});
