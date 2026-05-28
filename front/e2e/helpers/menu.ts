import type { Page } from '@playwright/test';

/** 사이드바 메뉴 — Ant Design 아이콘 접두사 없이 한글 라벨로 클릭 */
export const fnClickSidebarMenu = async (page: Page, strLabel: string): Promise<void> => {
  const locTitle = page.locator('.ant-menu-title-content').filter({ hasText: strLabel });
  if (await locTitle.count()) {
    await locTitle.first().click();
    return;
  }
  const locItem = page.getByRole('menuitem', { name: strLabel });
  if (await locItem.count()) {
    await locItem.first().click();
    return;
  }
  throw new Error(`사이드바 메뉴 없음: ${strLabel}`);
};
