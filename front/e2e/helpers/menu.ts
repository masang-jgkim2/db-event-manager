import type { Page } from '@playwright/test';

/** 사이드바 메뉴 라벨 — '대시보드' vs '나의 대시보드' 부분 일치 방지 */
export const fnSidebarMenuTitle = (page: Page, strLabel: string) =>
  page.locator('.ant-menu-title-content').getByText(strLabel, { exact: true });

/** 사이드바 메뉴 — Ant Design 아이콘 접두사 없이 한글 라벨로 클릭 */
export const fnClickSidebarMenu = async (page: Page, strLabel: string): Promise<void> => {
  // leaf 항목 우선 — «사용자» 그룹·하위 메뉴 라벨 중복 방지
  const locLeaf = page.locator('li.ant-menu-item').filter({
    has: page.locator('.ant-menu-title-content').getByText(strLabel, { exact: true }),
  });
  if (await locLeaf.count()) {
    await locLeaf.first().click();
    return;
  }
  const locTitle = fnSidebarMenuTitle(page, strLabel);
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
