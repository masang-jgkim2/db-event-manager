/**
 * browser-e2e: 「N건 처리」 vs 「N행 조회」 UI 예시 (headed 권장)
 */
import { chromium } from '@playwright/test';

const strBase = process.env.DQPM_BASE || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const strUser = process.env.DQPM_USER || 'dba01';
const strPass = process.env.DQPM_PASS || 'dba01';
const nInstanceId = Number(process.env.DEMO_INSTANCE_ID || 118);
const bHeaded = process.env.DQPM_HEADED === '1' || process.env.DQPM_HEADED === 'true';
const nSlowMo = Number(process.env.DQPM_SLOW_MO || 0) || 0;
const nHeadedWaitMs = Number(process.env.DQPM_HEADED_WAIT_MS || 60000);

const browser = await chromium.launch({
  headless: !bHeaded,
  slowMo: bHeaded ? (nSlowMo || 400) : 0,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill(strUser, { timeout: 15000 });
  await page.locator('input[type="password"]').first().fill(strPass);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

  await page.goto(`${strBase}/my-dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ant-table tbody tr', { timeout: 20000 });

  const row = page.locator('.ant-table tbody tr').filter({ hasText: String(nInstanceId) }).first();
  await row.getByRole('button', { name: '상세' }).click();

  const modal = page.locator('.ant-modal').filter({ hasText: '이벤트 상세' });
  await modal.waitFor({ state: 'visible', timeout: 10000 });

  const body = modal.locator('.ant-modal-body');
  await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(600);

  // 진행 이력이 접혀 있으면 펼침
  const btnHistCollapsed = modal.getByRole('button', { name: /collapsed.*진행 이력/ });
  if (await btnHistCollapsed.count()) await btnHistCollapsed.first().click();
  await page.waitForTimeout(800);

  // ① SELECT — 「N행 조회」 (데모 이력)
  const btnRowQuery = modal.getByRole('button', { name: /행 조회/ }).first();
  if (await btnRowQuery.count()) {
    await btnRowQuery.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scripts/probe-example-select-rows.png' });
  }

  // ② DELETE/UPDATE — 「N건 처리」
  const btnKen = modal.getByRole('button', { name: /건 처리/ }).first();
  if (await btnKen.count()) {
    await btnKen.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scripts/probe-example-affected-rows.png' });
  }

  // 나머지 collapsed도 펼쳐 전체 스샷
  const arrCollapsed = modal.getByRole('button', { expanded: false });
  const nCol = await arrCollapsed.count();
  for (let i = 0; i < nCol; i++) {
    await arrCollapsed.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: 'scripts/probe-example-full-expanded.png', fullPage: true });

  const strModal = await modal.innerText();
  console.log(JSON.stringify({
    nInstanceId,
    bHasKenProcessed: /\d+건 처리/.test(strModal),
    bHasRowQuery: /\d+행 조회/.test(strModal),
    bHasAntTable: (await modal.locator('.ant-table').count()) > 0,
    strKenSample: (strModal.match(/\d+건 처리/) || [])[0] || null,
    strRowSample: (strModal.match(/\d+행 조회/) || [])[0] || null,
  }, null, 2));

  if (bHeaded) {
    console.log(`[headed] ${nHeadedWaitMs / 1000}초 유지 — 스크린샷: scripts/probe-example-*.png`);
    await page.waitForTimeout(nHeadedWaitMs);
  }
} catch (err) {
  console.error('PROBE_FAIL', err?.message || err);
  await page.screenshot({ path: 'scripts/probe-example-error.png', fullPage: true });
  process.exitCode = 1;
  if (bHeaded) await page.waitForTimeout(10000).catch(() => {});
} finally {
  await browser.close();
}
