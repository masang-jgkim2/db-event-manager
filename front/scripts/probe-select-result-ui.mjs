/** 일회성: DQPM 로그인 → 나의 대시보드 → QA 실행 → SELECT 결과 캡처 */
import { chromium } from '@playwright/test';

const strBase = process.env.DQPM_BASE || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const strUser = process.env.DQPM_USER || 'dba01';
const strPass = process.env.DQPM_PASS || 'dba01';

const fnShot = async (page, strName) => {
  await page.screenshot({ path: `scripts/${strName}.png`, fullPage: true });
};

const bHeaded = process.env.DQPM_HEADED === '1' || process.env.DQPM_HEADED === 'true';
const nSlowMo = Number(process.env.DQPM_SLOW_MO || 0) || 0;
const browser = await chromium.launch({
  headless: !bHeaded,
  slowMo: bHeaded ? (nSlowMo || 300) : 0,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const objReport = { strUser, strBase, arrSteps: [] };

try {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input').first().fill(strUser);
  await page.locator('input[type="password"]').first().fill(strPass);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  objReport.arrSteps.push(`login_ok:${page.url()}`);
  await fnShot(page, 'probe-dba01-after-login');

  await page.goto(`${strBase}/my-dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.ant-table', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await fnShot(page, 'probe-dba01-my-dashboard');
  objReport.arrSteps.push('my_dashboard_loaded');

  const btnQa = page.getByRole('button', { name: 'QA 쿼리 실행' }).first();
  const nQaCount = await btnQa.count();
  objReport.nQaExecuteButtons = nQaCount;

  if (nQaCount > 0) {
    await btnQa.click();
    const popOk = page.locator('.ant-popconfirm').getByRole('button', { name: '실행' });
    await popOk.waitFor({ state: 'visible', timeout: 5000 });
    await popOk.click();
    objReport.arrSteps.push('qa_execute_confirmed');

    await page.waitForSelector('.ant-modal', { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const headerErr = page.locator('.ant-modal .ant-collapse-header').filter({ hasText: '오류 내용' });
    if (await headerErr.count()) await headerErr.first().click();
    const headerQuery = page.locator('.ant-modal .ant-collapse-header').filter({ hasText: '실행 시도 쿼리' });
    if (await headerQuery.count()) await headerQuery.first().click();
    await page.waitForTimeout(500);
    await fnShot(page, 'probe-dba01-after-qa-execute');

    const strModal = (await page.locator('.ant-modal').innerText().catch(() => '')) || '';
    objReport.strModalSnippet = strModal.slice(0, 800);
    const strBody = await page.locator('body').innerText();
    objReport.bHasQueryResultLabel = /쿼리별 결과/.test(strBody);
    objReport.bHasRowQueryText = /행 조회/.test(strBody);
    objReport.bHasAntTableInModal = (await page.locator('.ant-modal .ant-table').count()) > 0;
    objReport.bHasSuccessAlert = /성공적으로 실행/.test(strBody);
    objReport.bHasFail = /실행 실패|실행에 실패/.test(strBody);
  } else {
    const btnDetail = page.getByRole('button', { name: '상세' }).first();
    if (await btnDetail.count()) {
      await btnDetail.click();
      await page.waitForSelector('.ant-drawer, .ant-modal', { timeout: 10000 });
      await page.waitForTimeout(2000);
      const tabHistory = page.getByRole('tab', { name: /진행 이력|이력/ });
      if (await tabHistory.count()) await tabHistory.first().click();
      await page.waitForTimeout(1000);
      const collapseExec = page.locator('.ant-collapse').filter({ hasText: /실행|쿼리/ }).first();
      if (await collapseExec.count()) await collapseExec.click().catch(() => {});
      await fnShot(page, 'probe-dba01-detail-history');
      const strBody = await page.locator('body').innerText();
      objReport.bHasRowQueryText = /행 조회/.test(strBody);
      objReport.bHasAntTable = (await page.locator('.ant-table').count()) > 0;
      objReport.arrSteps.push('opened_detail_fallback');
    }
  }

  console.log(JSON.stringify(objReport, null, 2));
  if (bHeaded) {
    console.log('[headed] 20초 후 브라우저를 닫습니다. 먼저 닫으려면 창을 직접 종료하세요.');
    await page.waitForTimeout(20000);
  }
} catch (err) {
  console.error('PROBE_FAIL', err?.message || err);
  await fnShot(page, 'probe-dba01-error');
  process.exitCode = 1;
  if (bHeaded) await page.waitForTimeout(15000).catch(() => {});
} finally {
  await browser.close();
}
