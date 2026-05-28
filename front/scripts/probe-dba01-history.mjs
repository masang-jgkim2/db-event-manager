/** dba01: 성공 이력에서 SELECT 결과 테이블 확인 */
import { chromium } from '@playwright/test';

const strBase = process.env.DQPM_BASE || 'http://112.185.196.8:5173';
const strUser = 'dba01';
const strPass = 'dba01';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input').first().fill(strUser);
  await page.locator('input[type="password"]').first().fill(strPass);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });

  await page.goto(`${strBase}/my-dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ant-table tbody tr', { timeout: 15000 });

  const rowQaDone = page.locator('.ant-table tbody tr').filter({ hasText: 'QA 반영 실행' }).first();
  const nRows = await rowQaDone.count();
  if (!nRows) {
    console.log(JSON.stringify({ bFound: false, strReason: 'no_qa_deployed_row' }));
    process.exit(0);
  }

  await rowQaDone.getByRole('button', { name: '상세' }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  const histHeader = modal.locator('.ant-collapse-header').filter({ hasText: '진행 이력' });
  if (await histHeader.count()) {
    const panel = modal.locator('.ant-collapse-item').filter({ hasText: '진행 이력' });
    if (!(await panel.locator('.ant-collapse-content').isVisible().catch(() => false))) {
      await histHeader.click();
    }
  }
  await page.waitForTimeout(1000);

  const innerCollapse = modal.locator('.ant-timeline .ant-collapse-header');
  const nInner = await innerCollapse.count();
  for (let i = 0; i < nInner; i++) await innerCollapse.nth(i).click().catch(() => {});
  await page.waitForTimeout(800);

  const headers = modal.locator('.ant-collapse-header');
  const nH = await headers.count();
  for (let i = 0; i < Math.min(nH, 8); i++) {
    const el = headers.nth(i);
    const txt = await el.innerText();
    if (/QA|실행|쿼리/.test(txt)) await el.click().catch(() => {});
  }
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'scripts/probe-dba01-detail-history.png', fullPage: true });

  const strModal = await modal.innerText();
  console.log(JSON.stringify({
    bFound: true,
    bHasRowQueryText: /행 조회/.test(strModal),
    bHasAntTable: (await modal.locator('.ant-table').count()) > 0,
    bHasQueryResultLabel: /쿼리별 결과/.test(strModal),
    bHasQaExecBox: /QA.*처리/.test(strModal),
    strSnippet: strModal.slice(0, 1500),
  }));
} catch (e) {
  console.error('FAIL', e?.message);
  await page.screenshot({ path: 'scripts/probe-dba01-history-error.png', fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
