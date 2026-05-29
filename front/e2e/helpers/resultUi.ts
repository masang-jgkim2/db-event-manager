import { expect, type Locator, type Page } from '@playwright/test';
import { fnFindRowByIdPaging, fnGoMyDashboard } from './dashboard';

/** 이벤트 상세 모달 — 진행 이력·쿼리별 결과 Collapse */
export const fnOpenEventDetail = async (page: Page, nInstanceId: number): Promise<Locator> => {
  await fnGoMyDashboard(page);
  const row = await fnFindRowByIdPaging(page, nInstanceId);
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: '상세' }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
  await expect(modal).toBeVisible({ timeout: 15000 });
  return modal;
};

export const fnExpandProgressHistory = async (modal: Locator): Promise<void> => {
  const body = modal.locator('.ant-modal-body');
  await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const locHistoryPanel = modal.locator('.ant-collapse-item').filter({ hasText: '진행 이력' });
  const btnHistory = locHistoryPanel.getByRole('button').first();
  if (await btnHistory.count()) {
    const bExpanded = await btnHistory.getAttribute('aria-expanded');
    if (bExpanded === 'false') await btnHistory.click();
  }
  await expect(modal.getByText('진행 이력').first()).toBeVisible();
  await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await modal.page().waitForTimeout(400);
};

/** 「N행 조회」 / 「N건 처리」 Collapse 패널 펼침 — 헤더 accessible name은 「쿼리 1 3행 조회」 형태 */
export const fnExpandQueryResultPanel = async (modal: Locator, reTag: RegExp): Promise<Locator> => {
  const btn = modal.getByRole('button', { name: reTag }).first();
  if (!(await btn.count())) {
    await modal.getByText(reTag).first().scrollIntoViewIfNeeded();
  }
  await expect(modal.getByText(reTag).first()).toBeVisible({ timeout: 15000 });
  if (await btn.count()) {
    const bExpanded = await btn.getAttribute('aria-expanded');
    if (bExpanded === 'false') await btn.click();
  } else {
    await modal.getByText(reTag).first().click();
  }
  await modal.page().waitForTimeout(400);
  return modal.locator('.ant-collapse-item').filter({ hasText: reTag }).first();
};
