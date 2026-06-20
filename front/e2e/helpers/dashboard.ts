import { expect, type Page } from '@playwright/test';

/** Popconfirm 래핑 버튼 — accessible name 없음 */
export const fnRowBtn = (row: ReturnType<Page['locator']>, strBtn: string) =>
  row.locator('button').filter({ hasText: new RegExp(`^${strBtn}$`) });

export const fnRowByInstanceId = (page: Page, nId: number) =>
  page.locator('.ant-table tbody tr').filter({
    has: page.locator('td').filter({ hasText: new RegExp(`^${nId}$`) }),
  });

export const fnCloseModals = async (page: Page) => {
  for (let n = 0; n < 3; n++) {
    if (!(await page.locator('.ant-modal-wrap:visible').count())) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
};

const STR_TABLE_DATA_ROW = '.ant-table tbody tr:not(.ant-table-measure-row)';

/** AppTable 측정용 hidden 행 제외 — 데이터 행이 보일 때까지 대기 */
export const fnWaitDashboardTableReady = async (page: Page, nTimeout = 20000) => {
  await page.waitForSelector(STR_TABLE_DATA_ROW, { timeout: nTimeout, state: 'visible' });
};

/** ?nInstanceId= 딥링크는 상세 모달을 열어 행 버튼 클릭을 가림 — ID는 테이블 행 탐색만 사용 */
export const fnGoMyDashboard = async (page: Page) => {
  await page.goto('/my-dashboard');
  await fnWaitDashboardTableReady(page);
  await fnCloseModals(page);
};

export const fnFindRowByIdPaging = async (page: Page, nId: number) => {
  for (let n = 0; n < 25; n++) {
    const row = fnRowByInstanceId(page, nId);
    if (await row.count()) return row.first();
    const next = page.locator('.ant-pagination-next:not(.ant-pagination-disabled)');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(400);
  }
  return fnRowByInstanceId(page, nId).first();
};

export const fnSetDashFilter = async (page: Page, strLabel: string) => {
  const combobox = page.locator('.ant-card .ant-select').first();
  if (!(await combobox.count())) return;
  await combobox.click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option')
    .filter({ hasText: strLabel })
    .click();
  await page.waitForTimeout(400);
};

export const fnClickRowAction = async (
  page: Page,
  nId: number,
  strBtn: string,
  strPopOk: RegExp,
  objOpts?: { strDashFilter?: string },
) => {
  await fnGoMyDashboard(page);
  if (objOpts?.strDashFilter) await fnSetDashFilter(page, objOpts.strDashFilter);
  const row = await fnFindRowByIdPaging(page, nId);
  await expect(fnRowBtn(row, strBtn)).toBeVisible({ timeout: 15000 });
  await fnRowBtn(row, strBtn).click();
  const pop = page.locator('.ant-popconfirm');
  await pop.waitFor({ state: 'visible', timeout: 8000 });
  await pop.getByRole('button', { name: strPopOk }).click();
  await page.waitForTimeout(800);
};

/** 완료·숨김 탭 (삭제·숨김 건) — 토스트 문구와 구분 */
export const fnOpenCompletedDashTab = async (page: Page) => {
  const tab = page.locator('.ant-segmented .ant-segmented-item-label').filter({ hasText: /^완료·숨김/ });
  await tab.first().click();
  await page.waitForTimeout(500);
};

/** 영구 삭제 — Popconfirm 「삭제」 */
export const fnClickRowDelete = async (
  page: Page,
  nId: number,
  objOpts?: { strDashFilter?: string },
) => {
  await fnGoMyDashboard(page);
  if (objOpts?.strDashFilter) await fnSetDashFilter(page, objOpts.strDashFilter);
  const row = await fnFindRowByIdPaging(page, nId);
  await expect(fnRowBtn(row, '삭제')).toBeVisible({ timeout: 15000 });
  await fnRowBtn(row, '삭제').click();
  const pop = page.locator('.ant-popconfirm');
  await pop.waitFor({ state: 'visible', timeout: 8000 });
  await pop.getByRole('button', { name: /^삭제$/ }).click();
  await page.waitForTimeout(800);
};
