/**
 * dba01 headed: 이벤트·사용자 메뉴만 (운영 그룹 제외)
 */
import { chromium } from '@playwright/test';

const strBase = process.env.DQPM_BASE || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const strUser = process.env.DQPM_USER || 'dba01';
const strPass = process.env.DQPM_PASS || 'dba01';
const bHeaded = process.env.DQPM_HEADED === '1' || process.env.DQPM_HEADED === 'true';
const nSlowMo = Number(process.env.DQPM_SLOW_MO || 0) || (bHeaded ? 350 : 0);

/** 운영 그룹 제외 — MainLayout 이벤트·사용자 메뉴 */
const arrMenus = [
  { strLabel: '대시보드', strPath: '/', strShot: 'dash', fnCheck: async (page) => page.getByText(/대시보드|프로덕트|이벤트 인스턴스/i).first() },
  { strLabel: '프로덕트', strPath: '/products', strShot: 'products', fnCheck: async (page) => page.getByRole('heading', { name: '프로덕트 관리' }) },
  { strLabel: '쿼리 템플릿', strPath: '/events', strShot: 'events', fnCheck: async (page) => page.getByRole('heading', { name: '쿼리 템플릿' }) },
  { strLabel: 'DB 접속 정보', strPath: '/db-connections', strShot: 'db-conn', fnCheck: async (page) => page.getByText(/DB 접속|접속 정보/i).first() },
  { strLabel: '사용자', strPath: '/users', strShot: 'users', fnCheck: async (page) => page.getByRole('heading', { name: '사용자' }) },
  { strLabel: '역할 권한', strPath: '/roles', strShot: 'roles', fnCheck: async (page) => page.getByText(/역할|권한/i).first() },
  { strLabel: '활동', strPath: '/activity', strShot: 'activity', fnCheck: async (page) => page.getByText(/활동/i).first() },
];

const arrOpsExcluded = ['나의 대시보드', '이벤트 생성'];

const browser = await chromium.launch({ headless: !bHeaded, slowMo: nSlowMo });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const arrReport = [];

try {
  await page.goto(`${strBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input').first().fill(strUser);
  await page.locator('input[type="password"]').first().fill(strPass);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  arrReport.push({ step: 'login', bOk: true, url: page.url() });

  for (const item of arrMenus) {
    const menu = page.getByRole('menuitem', { name: item.strLabel, exact: true });
    const nCount = await menu.count();
    if (nCount === 0) {
      await page.goto(`${strBase}${item.strPath}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      if (!page.url().includes(item.strPath) && item.strPath !== '/') {
        arrReport.push({ menu: item.strLabel, bSkipped: true, strReason: '메뉴·URL 접근 불가' });
        continue;
      }
    } else {
      await menu.first().click();
    }
    await page.waitForURL((u) => u.pathname === item.strPath || (item.strPath === '/' && u.pathname === '/'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    let bOk = false;
    let strErr = '';
    try {
      const loc = await item.fnCheck(page);
      await loc.waitFor({ state: 'visible', timeout: 8000 });
      bOk = true;
    } catch (e) {
      strErr = e?.message?.slice(0, 120) || 'check_fail';
    }
    await page.screenshot({ path: `scripts/probe-non-ops-${item.strShot}.png`, fullPage: true });
    arrReport.push({ menu: item.strLabel, path: item.strPath, bOk, url: page.url(), strErr: strErr || undefined });

    if (item.strPath === '/products' && bOk) {
      const btnAdd = page.getByRole('button', { name: /새로운 프로덕트|추가/ }).first();
      if (await btnAdd.count()) {
        await btnAdd.click();
        await page.waitForTimeout(500);
        const dlg = page.getByRole('dialog');
        if (await dlg.count()) {
          await page.screenshot({ path: 'scripts/probe-non-ops-products-modal.png' });
          await page.getByRole('button', { name: /취소|닫기/ }).first().click().catch(() => page.keyboard.press('Escape'));
          arrReport.push({ menu: '프로덕트-모달', bOk: true });
        }
      }
    }
  }

  await page.goto(`${strBase}/`, { waitUntil: 'domcontentloaded' });
  const arrOpsVisible = [];
  for (const strLabel of arrOpsExcluded) {
    if (await page.getByRole('menuitem', { name: strLabel, exact: true }).count()) arrOpsVisible.push(strLabel);
  }
  arrReport.push({ step: 'ops_menu_visible_not_tested', arrLabels: arrOpsVisible, bExcludedFromTest: true });

  console.log(JSON.stringify({ strBase, strUser, bHeaded, arrReport }, null, 2));
  if (bHeaded) {
    console.log('[headed] 15초 후 종료');
    await page.waitForTimeout(15000);
  }
} catch (err) {
  console.error('PROBE_FAIL', err?.message);
  await page.screenshot({ path: 'scripts/probe-non-ops-error.png', fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}

const nFail = arrReport.filter((r) => r.bOk === false).length;
if (nFail > 0) process.exitCode = 1;
